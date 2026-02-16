import { useState } from 'react';
import { Card, Button, Input, Modal } from '@nmd/ui';
import { useAdminContext } from '../context/AdminContext';
import { listStaff, addStaff, updateStaff, removeStaff } from '@nmd/mock';
import type { StaffUser, Role } from '@nmd/core';

const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'مالك',
  MANAGER: 'مدير',
  STAFF: 'موظف',
};

export default function StaffPage() {
  const { tenantId } = useAdminContext();
  const staff = listStaff(tenantId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', role: 'STAFF' as Role });

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editing) {
      updateStaff(editing.id, { name: form.name, phone: form.phone || undefined, email: form.email || undefined, role: form.role });
    } else {
      addStaff({ tenantId, name: form.name, phone: form.phone || undefined, email: form.email || undefined, role: form.role });
    }
    setModalOpen(false);
    setEditing(null);
    setForm({ name: '', phone: '', email: '', role: 'STAFF' });
  };

  const handleEdit = (s: StaffUser) => {
    setEditing(s);
    setForm({ name: s.name, phone: s.phone ?? '', email: s.email ?? '', role: s.role });
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditing(null);
    setForm({ name: '', phone: '', email: '', role: 'STAFF' });
    setModalOpen(true);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">الفريق</h1>
        <Button onClick={handleAdd}>إضافة</Button>
      </div>
      <Card>
        <div className="p-6">
          {staff.length === 0 ? (
            <p className="text-center text-gray-500">لا يوجد فريق. أضف أعضاء.</p>
          ) : (
            <div className="divide-y divide-gray-200">
              {staff.map((s) => (
                <div key={s.id} className="py-4 flex justify-between items-center">
                  <div>
                    <span className="font-medium">{s.name}</span>
                    <span className="text-sm text-gray-500 me-2">({ROLE_LABELS[s.role]})</span>
                    {s.phone && <span className="text-sm text-gray-500">{s.phone}</span>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(s)} disabled={s.role === 'OWNER'}>
                      تعديل
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => removeStaff(s.id)} disabled={s.role === 'OWNER'}>
                      حذف
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null); }} title={editing ? 'تعديل عضو' : 'إضافة عضو'}>
        <div className="space-y-4">
          <Input label="الاسم" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="الجوال" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="اختياري" />
          <Input label="البريد" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="اختياري" />
          <div>
            <label className="block text-sm font-medium mb-1">الدور</label>
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))} className="w-full border rounded px-3 py-2">
              <option value="STAFF">موظف</option>
              <option value="MANAGER">مدير</option>
              {editing?.role === 'OWNER' && <option value="OWNER">مالك</option>}
            </select>
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <Button onClick={handleSave}>حفظ</Button>
          <Button variant="ghost" onClick={() => setModalOpen(false)}>إلغاء</Button>
        </div>
      </Modal>
    </div>
  );
}
