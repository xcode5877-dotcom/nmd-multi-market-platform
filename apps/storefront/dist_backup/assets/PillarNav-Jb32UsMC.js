import{s as t,u as k,j as a,L as w}from"./index-DdcDSTIy.js";/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=t("Briefcase",[["path",{d:"M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",key:"jecpp"}],["rect",{width:"20",height:"14",x:"2",y:"6",rx:"2",key:"i6l2r4"}]]);/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=t("ShoppingBag",[["path",{d:"M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z",key:"hou9p0"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M16 10a4 4 0 0 1-8 0",key:"1ltviw"}]]);/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const L=t("UtensilsCrossed",[["path",{d:"m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8",key:"n7qcjb"}],["path",{d:"M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7",key:"d0u48b"}],["path",{d:"m2.1 21.8 6.4-6.3",key:"yn04lh"}],["path",{d:"m19 5-7 7",key:"194lzd"}]]);/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A=t("Wrench",[["path",{d:"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",key:"cbrjhi"}]]),d=[{type:"food",label:"طعام",slug:"food",icon:L},{type:"retail",label:"تجزئة",slug:"retail",icon:h},{type:"services",label:"خدمات",slug:"services",icon:v},{type:"crafts",label:"حرفيون",slug:"crafts",icon:A}];function $({marketSlug:o,pillars:r=null,activePillarSlug:m=null}){const{pathname:l}=k(),p=o?`/${o}`:"",u=l.includes("/section/"),y=Array.isArray(r)&&r.length>0?r.map(e=>({key:e.id,slug:e.slug,label:e.nameAr||e.name,icon:e.icon})):d.map(e=>({key:e.type,slug:e.slug,label:e.label,icon:e.icon}));return a.jsx("nav",{className:"flex overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-5 px-5","aria-label":"أقسام السوق",children:a.jsx("div",{className:"flex gap-4 min-w-max justify-start",children:y.map(({key:e,slug:s,label:x,icon:n})=>{var c;const g=`${p}/section/${s}`,i=m===s||u&&l.endsWith(`/section/${s}`),b=typeof n=="string",f=((c=d.find(j=>j.slug===s))==null?void 0:c.icon)??h;return a.jsxs(w,{to:g,className:"shrink-0 snap-center flex flex-col items-center gap-2 group","aria-current":i?"page":void 0,children:[a.jsx("span",{className:`
                  flex w-14 h-14 md:w-16 md:h-16 rounded-full items-center justify-center
                  border-2 transition-all duration-200
                  shadow-sm
                  ${i?"bg-primary/20 border-primary text-primary shadow-md":"bg-white border-gray-200 text-gray-900 group-hover:border-primary/40 group-hover:bg-gray-100 group-hover:text-primary"}
                `,children:b&&n?a.jsx("span",{className:"text-2xl","aria-hidden":!0,children:n}):a.jsx(f,{className:"w-6 h-6 md:w-7 md:h-7 shrink-0","aria-hidden":!0})}),a.jsx("span",{className:`text-xs font-medium text-center max-w-[72px] truncate ${i?"text-primary":"text-gray-900"}`,children:x})]},e)})})})}export{$ as P};
