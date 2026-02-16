import { useState, useEffect } from 'react';
import {
  listOptionGroups,
  upsertOptionGroup,
  deleteOptionGroup,
  upsertOptionItem,
  deleteOptionItem,
} from '@nmd/mock';
import type { OptionGroup, OptionItem } from '@nmd/core';
import { filterOptionGroupsForTenant, generateId, formatMoney } from '@nmd/core';
import { Card, Button, Input, Modal } from '@nmd/ui';
import { useAdminContext } from '../context/AdminContext';

export default function OptionsPage() {
  const { tenantId, tenantType } = useAdminContext();
  const [allGroups, setAllGroups] = useState<OptionGroup[]>([]);
  const groups = filterOptionGroupsForTenant(tenantType, allGroups);
  const [selected, setSelected] = useState<OptionGroup | null>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [groupForm, setGroupForm] = useState({
    name: '',
    required: false,
    minSelected: 0,
    maxSelected: 1,
    selectionType: 'single' as 'single' | 'multi',
  });
  const [itemForm, setItemForm] = useState<{ id?: string; name: string; priceDelta: number; enabled: boolean; defaultSelected: boolean }>({ name: '', priceDelta: 0, enabled: true, defaultSelected: false });
  const editingItemId = itemForm.id;

  const refresh = () => setAllGroups(listOptionGroups(tenantId));

  useEffect(() => {
    refresh();
  }, [tenantId]);

  const handleSaveGroup = () => {
    if (!groupForm.name.trim()) return;
    const g: OptionGroup = {
      id: selected?.id ?? generateId(),
      tenantId,
      name: groupForm.name,
      required: groupForm.required,
      minSelected: groupForm.minSelected,
      maxSelected: groupForm.maxSelected,
      selectionType: groupForm.selectionType,
      items: selected?.items ?? [],
    };
    upsertOptionGroup(tenantId, g);
    refresh();
    setSelected(g);
    setGroupModalOpen(false);
    setGroupForm({ name: '', required: false, minSelected: 0, maxSelected: 1, selectionType: 'single' });
  };

  const handleDeleteGroup = (id: string) => {
    deleteOptionGroup(tenantId, id);
    if (selected?.id === id) setSelected(null);
    refresh();
  };

  const handleSaveItem = () => {
    if (!selected || !itemForm.name.trim()) return;
    const item: OptionItem = {
      id: editingItemId ?? generateId(),
      groupId: selected.id,
      name: itemForm.name,
      priceDelta: itemForm.priceDelta,
      sortOrder: selected.items?.length ?? 0,
      enabled: itemForm.enabled,
      defaultSelected: itemForm.defaultSelected,
    };
    upsertOptionItem(tenantId, selected.id, item);
    refresh();
    setSelected(listOptionGroups(tenantId).find((g) => g.id === selected.id) ?? selected);
  };

  const handleDeleteItem = (itemId: string) => {
    if (!selected) return;
    deleteOptionItem(tenantId, selected.id, itemId);
    refresh();
    setSelected(listOptionGroups(tenantId).find((g) => g.id === selected.id) ?? null);
  };

  const hintText = (g: OptionGroup) =>
    g.selectionType === 'single'
      ? 'اختيار واحد'
      : `اختيار حتى ${g.maxSelected}`;

  return (
    <div className="flex gap-6">
      <div className="w-72 flex-shrink-0">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-gray-900">مجموعات الخيارات</h1>
          <Button size="sm" onClick={() => { setSelected(null); setGroupForm({ name: '', required: false, minSelected: 0, maxSelected: 1, selectionType: 'single' }); setGroupModalOpen(true); }}>
            إضافة
          </Button>
        </div>
        <Card>
          <div className="divide-y divide-gray-200">
            {groups.map((g) => (
              <div
                key={g.id}
                className={`p-3 cursor-pointer ${selected?.id === g.id ? 'bg-primary/10' : 'hover:bg-gray-50'}`}
                onClick={() => setSelected(g)}
              >
                <span className="font-medium">{g.name}</span>
                <span className="text-gray-500 text-sm block">{hintText(g)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="flex-1">
        {selected ? (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">{selected.name}</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setGroupForm({ name: selected.name, required: selected.required, minSelected: selected.minSelected, maxSelected: selected.maxSelected, selectionType: selected.selectionType }); setGroupModalOpen(true); }}>
                  تعديل المجموعة
                </Button>
                <Button size="sm" onClick={() => { setItemForm({ name: '', priceDelta: 0, enabled: true, defaultSelected: false }); setItemModalOpen(true); }}>
                  إضافة خيار
                </Button>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteGroup(selected.id)}>
                  حذف المجموعة
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-4">{hintText(selected)}</p>
            <div className="divide-y divide-gray-200">
              {(selected.items ?? []).map((i) => (
                <div key={i.id} className="flex justify-between items-center py-3">
                  <div>
                    <span className="font-medium">{i.name}</span>
                    <span className="text-gray-500 text-sm me-2">
                      {(i.priceDelta ?? i.priceModifier ?? 0) >= 0 ? '+' : ''}
                      {formatMoney(i.priceDelta ?? i.priceModifier ?? 0)}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setItemForm({ id: i.id, name: i.name, priceDelta: i.priceDelta ?? i.priceModifier ?? 0, enabled: i.enabled ?? true, defaultSelected: i.defaultSelected ?? false }); setItemModalOpen(true); }}>تعديل</Button>
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteItem(i.id)}>حذف</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="p-12 text-center text-gray-500">
            اختر مجموعة أو أضف جديدة
          </Card>
        )}
      </div>
      <Modal open={groupModalOpen} onClose={() => setGroupModalOpen(false)} title={selected ? 'تعديل مجموعة' : 'إضافة مجموعة'}>
        <div className="space-y-4">
          <Input label="الاسم" value={groupForm.name} onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))} />
          <label className="flex items-center gap-2"><input type="checkbox" checked={groupForm.required} onChange={(e) => setGroupForm((f) => ({ ...f, required: e.target.checked }))} />مطلوب</label>
          <div>
            <label className="block text-sm font-medium mb-1">نوع الاختيار</label>
            <select value={groupForm.selectionType} onChange={(e) => setGroupForm((f) => ({ ...f, selectionType: e.target.value as 'single' | 'multi' }))} className="w-full border rounded px-3 py-2">
            <option value="single">اختيار واحد</option>
            <option value="multi">اختيار متعدد</option>
          </select>
          </div>
          <Input label="الحد الأدنى" type="number" value={groupForm.minSelected} onChange={(e) => setGroupForm((f) => ({ ...f, minSelected: +e.target.value }))} />
          <Input label="الحد الأقصى" type="number" value={groupForm.maxSelected} onChange={(e) => setGroupForm((f) => ({ ...f, maxSelected: +e.target.value }))} />
        </div>
        <div className="mt-6 flex gap-2">
          <Button onClick={handleSaveGroup}>حفظ</Button>
          <Button variant="ghost" onClick={() => setGroupModalOpen(false)}>إلغاء</Button>
        </div>
      </Modal>
      <Modal open={itemModalOpen} onClose={() => setItemModalOpen(false)} title={editingItemId ? 'تعديل خيار' : 'إضافة خيار'}>
        <div className="space-y-4">
          <Input label="الاسم" value={itemForm.name} onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="التعديل على السعر (₪)" type="number" value={itemForm.priceDelta} onChange={(e) => setItemForm((f) => ({ ...f, priceDelta: +e.target.value }))} />
          <label className="flex items-center gap-2"><input type="checkbox" checked={itemForm.enabled} onChange={(e) => setItemForm((f) => ({ ...f, enabled: e.target.checked }))} />مفعّل</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={itemForm.defaultSelected} onChange={(e) => setItemForm((f) => ({ ...f, defaultSelected: e.target.checked }))} />محدد افتراضياً</label>
        </div>
        <div className="mt-6 flex gap-2">
          <Button onClick={handleSaveItem}>حفظ</Button>
          <Button variant="ghost" onClick={() => setItemModalOpen(false)}>إلغاء</Button>
        </div>
      </Modal>
    </div>
  );
}
