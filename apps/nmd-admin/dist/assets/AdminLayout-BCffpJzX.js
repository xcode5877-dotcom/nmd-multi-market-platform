import{l as n,u as M,p as b,c as v,r as m,j as a,g as N,O as A,M as j}from"./index-BYQekpkv.js";import{s as g}from"./api-CiuOvftP.js";import{L as c}from"./layout-dashboard-B6RxTxQS.js";import{S as i}from"./store-DNvF2B3V.js";/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=n("Building2",[["path",{d:"M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z",key:"1b4qmf"}],["path",{d:"M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2",key:"i71pzd"}],["path",{d:"M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2",key:"10jefs"}],["path",{d:"M10 6h4",key:"1itunk"}],["path",{d:"M10 10h4",key:"tcdvrf"}],["path",{d:"M10 14h4",key:"kelpxr"}],["path",{d:"M10 18h4",key:"1ulq68"}]]);/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w=n("FileText",[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M10 9H8",key:"b1mrlr"}],["path",{d:"M16 13H8",key:"t4e002"}],["path",{d:"M16 17H8",key:"z1uh3a"}]]);/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C=n("MapPin",[["path",{d:"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",key:"1r0f0z"}],["circle",{cx:"12",cy:"10",r:"3",key:"ilqhr7"}]]);/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E=n("Package",[["path",{d:"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z",key:"1a0edw"}],["path",{d:"M12 22V12",key:"d0xqtd"}],["path",{d:"m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7",key:"yx3hmr"}],["path",{d:"m7.5 4.27 9 5.15",key:"1c824w"}]]);/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const F=n("Shield",[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}]]);/**
 * @license lucide-react v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const I=n("ShoppingCart",[["circle",{cx:"8",cy:"21",r:"1",key:"jimo8o"}],["circle",{cx:"19",cy:"21",r:"1",key:"13723u"}],["path",{d:"M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12",key:"9zh506"}]]),p="",T=new j;function D(){const x=M(),t=b(),{data:e}=v({queryKey:["me",x.token],queryFn:()=>T.getMe(),enabled:!1}),d=(e==null?void 0:e.role)==="ROOT_ADMIN",l=(e==null?void 0:e.role)==="MARKET_ADMIN",r=(e==null?void 0:e.role)==="TENANT_ADMIN",s=e==null?void 0:e.marketId;m.useEffect(()=>{g((t==null?void 0:t.enabled)??!1,(t==null?void 0:t.reason)??"")},[t==null?void 0:t.enabled,t==null?void 0:t.reason]);const k=s?[{to:`/markets/${s}`,icon:c,label:"Overview",end:!0},{to:`/markets/${s}/tenants`,icon:h,label:"Tenants",end:!1},{to:`/markets/${s}/orders`,icon:i,label:"Orders",end:!1}]:[],u=r?[{to:"/tenant",icon:c,label:"الرئيسية",end:!0},{to:"/tenant/products",icon:E,label:"المنتجات",end:!1},{to:"/tenant/delivery-zones",icon:C,label:"مناطق التوصيل",end:!1},{to:"/tenant/orders",icon:I,label:"الطلبات",end:!1},{to:"/tenant/account/security",icon:F,label:"الأمان",end:!1}]:l?k:d?[{to:"/markets",icon:i,label:"Markets",end:!0},{to:"/tenants",icon:h,label:"Global Tenants",end:!0},{to:"/audit",icon:w,label:"Audit",end:!0}]:[],y=l&&!s||r&&!(e!=null&&e.tenantId)||d===!1&&l===!1&&!r&&!!e;return a.jsxs("div",{className:"min-h-screen flex",children:[a.jsxs("aside",{className:"w-56 bg-[#1E293B] border-e border-[#0F172A]/50 flex flex-col",children:[a.jsxs("div",{className:"p-4 border-b border-[#0F172A]/50",children:[a.jsx("h1",{className:"font-bold text-lg text-white",children:"NMD OS Control"}),p,p]}),a.jsx("nav",{className:"flex-1 p-2 space-y-1",children:y?a.jsx("div",{className:"px-3 py-2 text-xs text-gray-500",children:"جاري التحميل..."}):a.jsx(a.Fragment,{children:u.map(o=>a.jsxs(N,{to:o.to,end:o.end,className:({isActive:f})=>`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${f?"bg-[#7C3AED] text-white":"text-gray-300 hover:bg-[#334155] hover:text-white"}`,children:[a.jsx(o.icon,{className:"w-5 h-5"}),o.label]},o.to))})})]}),a.jsx("main",{className:"flex-1 overflow-auto bg-[#F8FAFC]",children:a.jsx("div",{className:"p-6",children:a.jsx(A,{})})})]})}export{D as default};
