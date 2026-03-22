--
-- PostgreSQL database dump
--

\restrict WfV7wsGkYRpg5YCkohkPsJPsqkW9Z6H8xvDjM4vZOrOq7bgbhrhk279Waaf7DVU

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: nmd
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO nmd;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: nmd
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: CatalogCategory; Type: TABLE; Schema: public; Owner: nmd
--

CREATE TABLE public."CatalogCategory" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    "imageUrl" text,
    "sortOrder" integer NOT NULL,
    "parentId" text,
    "isVisible" boolean DEFAULT true
);


ALTER TABLE public."CatalogCategory" OWNER TO nmd;

--
-- Name: CatalogOptionGroup; Type: TABLE; Schema: public; Owner: nmd
--

CREATE TABLE public."CatalogOptionGroup" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    type text,
    required boolean NOT NULL,
    "minSelected" integer NOT NULL,
    "maxSelected" integer NOT NULL,
    "selectionType" text NOT NULL,
    scope text,
    "scopeId" text,
    "allowHalfPlacement" boolean,
    items text
);


ALTER TABLE public."CatalogOptionGroup" OWNER TO nmd;

--
-- Name: CatalogProduct; Type: TABLE; Schema: public; Owner: nmd
--

CREATE TABLE public."CatalogProduct" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "categoryId" text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    type text NOT NULL,
    "basePrice" double precision NOT NULL,
    currency text NOT NULL,
    "imageUrl" text,
    images text,
    "optionGroups" text,
    variants text,
    stock integer,
    "isAvailable" boolean NOT NULL,
    "createdAt" text,
    "isFeatured" boolean,
    "isArchived" boolean DEFAULT false,
    "sortOrder" integer DEFAULT 0
);


ALTER TABLE public."CatalogProduct" OWNER TO nmd;

--
-- Name: Contest; Type: TABLE; Schema: public; Owner: nmd
--

CREATE TABLE public."Contest" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    type text NOT NULL,
    options text,
    "correctAnswer" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "rewardCode" text,
    "expiresAt" text,
    "createdAt" text NOT NULL,
    "bannerImageUrl" text,
    "teamAName" text,
    "teamBName" text,
    "isPrediction" boolean DEFAULT false NOT NULL,
    "finalScoreA" integer,
    "finalScoreB" integer
);


ALTER TABLE public."Contest" OWNER TO nmd;

--
-- Name: ContestParticipation; Type: TABLE; Schema: public; Owner: nmd
--

CREATE TABLE public."ContestParticipation" (
    id text NOT NULL,
    "customerId" text NOT NULL,
    "contestId" text NOT NULL,
    "userAnswer" text NOT NULL,
    "isWinner" boolean DEFAULT false NOT NULL,
    "createdAt" text NOT NULL,
    "scoreA" integer,
    "scoreB" integer
);


ALTER TABLE public."ContestParticipation" OWNER TO nmd;

--
-- Name: Courier; Type: TABLE; Schema: public; Owner: nmd
--

CREATE TABLE public."Courier" (
    id text NOT NULL,
    "scopeType" text NOT NULL,
    "scopeId" text NOT NULL,
    "marketId" text,
    name text NOT NULL,
    phone text,
    "isActive" boolean DEFAULT true NOT NULL,
    "isOnline" boolean DEFAULT false NOT NULL,
    capacity integer DEFAULT 1 NOT NULL,
    "isAvailable" boolean,
    "deliveryCount" integer
);


ALTER TABLE public."Courier" OWNER TO nmd;

--
-- Name: Customer; Type: TABLE; Schema: public; Owner: nmd
--

CREATE TABLE public."Customer" (
    id text NOT NULL,
    phone text NOT NULL,
    name text,
    "createdAt" text NOT NULL
);


ALTER TABLE public."Customer" OWNER TO nmd;

--
-- Name: DeliveryZone; Type: TABLE; Schema: public; Owner: nmd
--

CREATE TABLE public."DeliveryZone" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    fee double precision NOT NULL,
    "etaMinutes" integer,
    "minimumOrder" double precision,
    geo text,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer
);


ALTER TABLE public."DeliveryZone" OWNER TO nmd;

--
-- Name: Market; Type: TABLE; Schema: public; Owner: nmd
--

CREATE TABLE public."Market" (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    branding text,
    "isActive" boolean DEFAULT true NOT NULL,
    "sortOrder" integer,
    "paymentCapabilities" text,
    "imageUrl" text
);


ALTER TABLE public."Market" OWNER TO nmd;

--
-- Name: Order; Type: TABLE; Schema: public; Owner: nmd
--

CREATE TABLE public."Order" (
    id text NOT NULL,
    "tenantId" text,
    "courierId" text,
    "marketId" text,
    status text,
    "fulfillmentType" text,
    "orderType" text DEFAULT 'PRODUCT'::text,
    total double precision,
    "createdAt" text,
    payment text,
    "deliveryTimeline" text,
    payload text
);


ALTER TABLE public."Order" OWNER TO nmd;

--
-- Name: Payment; Type: TABLE; Schema: public; Owner: nmd
--

CREATE TABLE public."Payment" (
    id text NOT NULL,
    "orderId" text NOT NULL,
    method text NOT NULL,
    status text NOT NULL,
    amount double precision NOT NULL,
    currency text DEFAULT 'ILS'::text NOT NULL,
    provider text,
    "providerRef" text,
    "createdAt" text NOT NULL,
    "updatedAt" text NOT NULL
);


ALTER TABLE public."Payment" OWNER TO nmd;

--
-- Name: Tenant; Type: TABLE; Schema: public; Owner: nmd
--

CREATE TABLE public."Tenant" (
    id text NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    "logoUrl" text NOT NULL,
    "primaryColor" text NOT NULL,
    "secondaryColor" text NOT NULL,
    "fontFamily" text NOT NULL,
    "radiusScale" double precision NOT NULL,
    "layoutStyle" text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "createdAt" text NOT NULL,
    "templateId" text,
    hero text,
    banners text,
    "whatsappPhone" text,
    type text,
    "businessType" text DEFAULT 'RETAIL'::text,
    "marketCategory" text,
    "marketId" text,
    "isListedInMarket" boolean,
    "marketSortOrder" integer,
    "tenantType" text,
    "deliveryProviderMode" text,
    "allowMarketCourierFallback" boolean,
    "defaultPrepTimeMin" integer,
    "financialConfig" text,
    "paymentCapabilities" text,
    "operationalStatus" text,
    "orderPolicy" text,
    "businessHours" text,
    "busyBannerEnabled" boolean,
    "busyBannerText" text,
    "bookingEnabled" boolean,
    about text,
    "officeHours" text,
    phone text,
    "storeType" text,
    "appointmentDuration" integer,
    collections text,
    "openTime" text,
    "closeTime" text,
    "forceClosed" boolean DEFAULT false,
    "deliveryRadiusKm" double precision,
    "addressLine" text,
    location text,
    meta text,
    "pillarId" text,
    "subCategoryId" text
);


ALTER TABLE public."Tenant" OWNER TO nmd;

--
-- Name: TenantDeliverySettings; Type: TABLE; Schema: public; Owner: nmd
--

CREATE TABLE public."TenantDeliverySettings" (
    "tenantId" text NOT NULL,
    modes text,
    "minimumOrder" double precision DEFAULT 0 NOT NULL,
    "deliveryFee" double precision DEFAULT 0 NOT NULL,
    payload text
);


ALTER TABLE public."TenantDeliverySettings" OWNER TO nmd;

--
-- Name: User; Type: TABLE; Schema: public; Owner: nmd
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    "marketId" text,
    "tenantId" text,
    "courierId" text,
    password text,
    "mustChangePassword" boolean DEFAULT false
);


ALTER TABLE public."User" OWNER TO nmd;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: nmd
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO nmd;

--
-- Name: whatsapp_logs; Type: TABLE; Schema: public; Owner: nmd
--

CREATE TABLE public.whatsapp_logs (
    id integer NOT NULL,
    phone text NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.whatsapp_logs OWNER TO nmd;

--
-- Name: whatsapp_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: nmd
--

CREATE SEQUENCE public.whatsapp_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.whatsapp_logs_id_seq OWNER TO nmd;

--
-- Name: whatsapp_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: nmd
--

ALTER SEQUENCE public.whatsapp_logs_id_seq OWNED BY public.whatsapp_logs.id;


--
-- Name: whatsapp_logs id; Type: DEFAULT; Schema: public; Owner: nmd
--

ALTER TABLE ONLY public.whatsapp_logs ALTER COLUMN id SET DEFAULT nextval('public.whatsapp_logs_id_seq'::regclass);


--
-- Data for Name: CatalogCategory; Type: TABLE DATA; Schema: public; Owner: nmd
--

COPY public."CatalogCategory" (id, "tenantId", name, slug, description, "imageUrl", "sortOrder", "parentId", "isVisible") FROM stdin;
3d5db590-9ceb-4f0b-a656-6a310fe1329c	5b35539f-90e1-49cc-8c32-8d26cdce20f2	Tops	tops	\N	\N	3	\N	t
b7c139c8-8142-4888-b0a8-601d24b48d30	5b35539f-90e1-49cc-8c32-8d26cdce20f2	Suits 	suits-	\N	\N	4	\N	t
00df689e-2efe-4329-be11-0f8d3efe4047	5b35539f-90e1-49cc-8c32-8d26cdce20f2	Pants	pants	\N	\N	5	\N	t
be51dd05-83fe-4ba8-a6f6-003174fc7695	f741d517-e7e6-48c9-a046-18d85acf1d25	فساتين	فساتين	\N	\N	0	\N	t
78e7fa6f-6228-4e23-8172-8a7d326ca9b7	f741d517-e7e6-48c9-a046-18d85acf1d25	جاكيتات	جاكيتات	\N	\N	3	\N	t
80a61598-436a-4a3d-9de7-ef4a863eb9c5	f741d517-e7e6-48c9-a046-18d85acf1d25	أطقم	أطقم	\N	\N	4	\N	t
cad82514-655f-4682-9ad8-24839dc45e8f	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	for you	for you	\N	\N	0	\N	t
15a1b5ad-bd38-4fb5-b948-7962f9755463	1cc59722-3687-45a1-9121-e7a608fba225	بيتسا	بيتسا	\N	\N	0	\N	t
88932d34-a22f-4fa8-81fc-bdb7ff3ee1f5	1cc59722-3687-45a1-9121-e7a608fba225	مشروبات	مشروبات	\N	\N	1	\N	t
00de19f2-0677-41fb-a47a-1da0f10fb9df	60904bcc-970a-45e3-8669-8015ee2afe64	فساتين	فساتين	\N	\N	0	\N	t
d041352a-542e-4745-a4d4-42830b66da5b	60904bcc-970a-45e3-8669-8015ee2afe64	بلايز	بلايز	\N	\N	1	\N	t
1a5b2d5d-0050-4e77-9250-1659648e4c46	60904bcc-970a-45e3-8669-8015ee2afe64	بناطيل	بناطيل	\N	\N	2	\N	t
0a0e4c11-3512-43be-b6d0-0a41d3a83c08	60904bcc-970a-45e3-8669-8015ee2afe64	جاكيتات	جاكيتات	\N	\N	3	\N	t
8bd4ccfa-73b0-4e7f-b8df-ff41e1a4addb	60904bcc-970a-45e3-8669-8015ee2afe64	أطقم	أطقم	\N	\N	4	\N	t
cat-drawshe-1	1c6f3866-a475-445e-8806-42065adea654	خدمات قانونية	legal-services	\N	\N	0	\N	t
fba36c55-c38e-451b-b73b-7ce91a3ba575	6d59233f-5edd-463b-b379-2697e5b6df34	سحور رمضان	سحور رمضان	\N	\N	0	\N	t
07fc715f-c51a-4774-b698-02cecbb39009	0c36235a-9473-4226-b091-71e3fb0efdc5	سحور رمضان	سحور-رمضان	\N	\N	0	\N	t
94f42e0b-25c3-406d-8a58-d02613b74358	f6e493da-e69f-4bbc-877b-8842a1dfb72e	سحور رمضان	سحور رمضان	\N	\N	0	\N	t
59609c45-3fbb-4b39-82be-6dd7209e240b	b48b688d-fb40-4dd8-86da-b3d34dd1fffc	ورود	ورود	\N	\N	0	\N	t
3f72a4ff-f5e3-428a-adca-467321eb9e83	2f663230-f9b3-463c-b8ab-eb55a5474b95	قشطوطة	قشطوطة	\N	\N	0	\N	t
f5bfd656-d9c1-41e9-af52-41eb9b215cf9	2f663230-f9b3-463c-b8ab-eb55a5474b95	كعك	كعك	\N	\N	1	\N	t
81bc78b8-de83-41f8-b6fd-fecb9392deb3	2f663230-f9b3-463c-b8ab-eb55a5474b95	حلو يا حلو	حلو يا حلو	\N	\N	2	\N	t
0add86a7-97bb-4495-a3e3-e3d22794b4b0	2f663230-f9b3-463c-b8ab-eb55a5474b95	دلع نفسك	دلع نفسك	\N	\N	3	\N	t
7b43e146-2b38-4003-894a-44f1c6d127f9	2f663230-f9b3-463c-b8ab-eb55a5474b95	ميلك شيك	ميلك شيك	\N	\N	4	\N	t
0a915473-a6f3-4438-bb08-fc143a46d943	2f663230-f9b3-463c-b8ab-eb55a5474b95	موخيتو	موخيتو	\N	\N	5	\N	t
f251320a-c816-47b3-816e-f027a6fb4975	2f663230-f9b3-463c-b8ab-eb55a5474b95	مشروبات باردة	مشروبات باردة	\N	\N	7	\N	t
771dc16e-86b4-471b-91c4-61b4c754fafa	2f663230-f9b3-463c-b8ab-eb55a5474b95	مشروبات منعشة 	مشروبات منعشة 	\N	\N	8	\N	t
47c7658d-7663-426c-97cd-0436e757c754	2f663230-f9b3-463c-b8ab-eb55a5474b95	لمة الحبايب	لمة الحبايب	\N	\N	9	\N	t
2005cb3b-70d5-4b5e-a4ef-b144f636c28d	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	حلويات	حلويات	\N	\N	0	\N	t
94b0e9c6-fbc0-4023-a823-4941b142650d	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	كعك	كعك	\N	\N	1	\N	t
64dff88f-0664-4489-a7b7-5d2e5aac9690	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	ميلك شيك	ميلك شيك	\N	\N	2	\N	t
441516b1-b539-4a48-a490-4596fcdac409	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	طبيعي	طبيعي	\N	\N	3	\N	t
4a153659-44de-4068-9405-fa73a3c53f49	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	بوظة	بوظة	\N	\N	4	\N	t
d78f85d5-ed7b-4b62-9e8a-6069641e8c1a	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	موخيتو	موخيتو	\N	\N	5	\N	t
2fa37ae7-56e8-4bee-a59f-a5de98e66f55	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	مشروبات باردة	مشروبات باردة	\N	\N	6	\N	t
43d5145a-d272-4eca-bffc-f9475dde73d0	62af86ec-0ef7-42fb-b707-c197cab8d05c	ساندويشات	ساندويشات	\N	\N	0	\N	t
1ca8a3be-7309-45e5-a9f0-24de44918ead	62af86ec-0ef7-42fb-b707-c197cab8d05c	سلطات	سلطات	\N	\N	1	\N	t
cfd0de43-c99a-49c9-8194-35f9c82c549a	3eb37051-3217-489f-a471-5927cab34b0d	بوظة	بوظة	\N	\N	0	\N	t
cat-lawyer-001	a7b8c9d0-e1f2-4a3b-8c9d-0e1f2a3b4c5d	الخدمات القانونية	legal-services	\N	\N	0	\N	t
82a1f61b-eee2-4ed5-890d-8cf32b4e2151	5b35539f-90e1-49cc-8c32-8d26cdce20f2	Jeans	jeans	\N	\N	0	\N	t
470a17ec-8b2f-41d5-9e60-ce9077ae644c	5b35539f-90e1-49cc-8c32-8d26cdce20f2	Jacket	Jacket	\N	\N	1	\N	t
cecfa7f7-0790-4013-8d2c-b4fd78f8548c	5b35539f-90e1-49cc-8c32-8d26cdce20f2	Dress 	dress-	\N	\N	2	\N	t
8753e0d7-749d-4d3e-9ee9-75e0cec314eb	f741d517-e7e6-48c9-a046-18d85acf1d25	بلايز	بلايز	\N	\N	1	\N	t
df08e6ab-e97a-496d-a880-bd3b3f12ab5f	f741d517-e7e6-48c9-a046-18d85acf1d25	بناطيل	بناطيل	\N	\N	2	\N	t
\.


--
-- Data for Name: CatalogOptionGroup; Type: TABLE DATA; Schema: public; Owner: nmd
--

COPY public."CatalogOptionGroup" (id, "tenantId", name, type, required, "minSelected", "maxSelected", "selectionType", scope, "scopeId", "allowHalfPlacement", items) FROM stdin;
30e4262c-d61b-4d47-82c0-be95ebdfaee6	1cc59722-3687-45a1-9121-e7a608fba225	مقاسات ملابس	SIZE	t	1	1	single	\N	\N	\N	[{"id":"16be366b-19cd-4553-9eb0-9a4c7ed53c59","name":"S","sortOrder":0},{"id":"7bf4ba88-9806-4434-9f91-2682d8daab2c","name":"M","sortOrder":1},{"id":"8c0943f3-42be-42a5-ac3b-7f6851ec851e","name":"L","sortOrder":2},{"id":"8c6fb185-0ecd-48d8-90f8-76eebdb34099","name":"XL","sortOrder":3}]
b2a84f05-3d08-4e35-8152-a69607c279f4	1cc59722-3687-45a1-9121-e7a608fba225	ألوان شائعة	COLOR	f	0	1	single	\N	\N	\N	[{"id":"9c4ce7b2-6317-4201-a71d-e36e46b5e17d","name":"أسود","sortOrder":0},{"id":"ab97072a-eeb5-4e33-855f-62376f049639","name":"أبيض","sortOrder":1},{"id":"82c93ad9-faf6-46a2-bc77-1a41a8ddcc00","name":"بيج","sortOrder":2},{"id":"d53575a5-47d9-42e3-8e2e-b2bddf310bad","name":"أزرق","sortOrder":3},{"id":"e3710571-f941-4418-85c9-538b2114a251","name":"وردي","sortOrder":4}]
8060d543-c992-48ba-9b41-d1561fb7fd9c	60904bcc-970a-45e3-8669-8015ee2afe64	مقاسات ملابس	SIZE	t	1	1	single	\N	\N	\N	[{"id":"cd8fab14-0094-4f88-8494-19789333705f","name":"S","sortOrder":0},{"id":"0d73572c-e6ad-4571-b86d-09bd912000d4","name":"M","sortOrder":1},{"id":"7e8d8f01-c283-4d40-8b09-e224a959b6c8","name":"L","sortOrder":2},{"id":"8676ca2a-e290-4eb1-a257-edebbe48472d","name":"XL","sortOrder":3}]
d029d825-038b-40b5-af65-c981f8ba40ba	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	بوظة	\N	f	1	6	multi	\N	\N	\N	[{"id":"1f7d1706-bcd9-4f2e-b8b2-71cefab57a2d","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"اوريو","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"1050b1b6-af2b-4893-ac62-282d0e97611f","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"لوتوس","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false},{"id":"b8e43810-6ddb-41b7-bbb8-5c9ca6182e2e","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"كيندر","priceDelta":0,"sortOrder":2,"enabled":true,"defaultSelected":false},{"id":"f972d0f9-0c51-4d92-9db2-1821c7d7f1ef","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"مكوبيلت","priceDelta":0,"sortOrder":3,"enabled":true,"defaultSelected":false},{"id":"728c7868-da19-498d-9c18-7e7ce6c43a64","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"علكة ","priceDelta":0,"sortOrder":4,"enabled":true,"defaultSelected":false},{"id":"5c9068d3-fcb9-4754-b0c2-3404cdc183f9","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"مارشميلو","priceDelta":0,"sortOrder":5,"enabled":true,"defaultSelected":false},{"id":"abbff3f4-4f24-40e3-b760-6c332cf7da35","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"فيريرو روشيه","priceDelta":0,"sortOrder":6,"enabled":true,"defaultSelected":false},{"id":"21fcb80d-114c-4917-83a6-be25fb2cd4d3","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"فواكه بريه (بيروت ياعر )","priceDelta":0,"sortOrder":7,"enabled":true,"defaultSelected":false},{"id":"fbafe2e9-8d3e-452d-a488-319da669715c","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"بسفلورا","priceDelta":0,"sortOrder":8,"enabled":true,"defaultSelected":false},{"id":"b61585e5-ec5a-4036-b07a-7eb10ad8bcc5","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"كراميل ريبات حلاف","priceDelta":0,"sortOrder":9,"enabled":true,"defaultSelected":false},{"id":"81abe5cb-6ae5-4083-a16f-4ed6a7c0d82d","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"كليك","priceDelta":0,"sortOrder":11,"enabled":true,"defaultSelected":false},{"id":"1b293a4e-f8fc-474b-a3b8-aeccb017de7c","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"شوكلاتة دبي","priceDelta":0,"sortOrder":12,"enabled":true,"defaultSelected":false},{"id":"c39d64b1-4d75-49e9-8079-56e3bec3863e","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"توت شمينت","priceDelta":0,"sortOrder":12,"enabled":true,"defaultSelected":false},{"id":"63914c55-73fd-4fd7-b726-4978ad30f666","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"كرز","priceDelta":0,"sortOrder":13,"enabled":true,"defaultSelected":false}]
40aa5054-4b7c-4061-b6fe-14c0262dee15	f741d517-e7e6-48c9-a046-18d85acf1d25	مقاسات ملابس	SIZE	t	1	1	single	\N	\N	\N	[{"id":"b9128f88-1dd4-41ce-8358-35c9e56ead5f","name":"S","sortOrder":0},{"id":"25c3b4b4-1457-4dcf-b0ea-af6a1d513408","name":"M","sortOrder":1},{"id":"04a91785-3b15-4e36-9bf7-5842c925f2cc","name":"L","sortOrder":2},{"id":"908400f4-70e3-4e71-bc3b-1af36a01a81d","name":"XL","sortOrder":3}]
69cc0052-7fa3-421b-8adc-dc221cd0e77c	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	مقاسات ملابس	SIZE	t	1	1	single	\N	\N	\N	[{"id":"c11958fb-d990-421e-a040-3bacec63991f","name":"S","sortOrder":0},{"id":"3d6275ce-e60e-4e0a-ad8a-a6e172bcd8c8","name":"M","sortOrder":1},{"id":"91938817-c5cc-4f53-bf57-1c9456b9d5f9","name":"L","sortOrder":2},{"id":"5aa98b80-98d4-446b-99d4-f6faf2954be2","name":"XL","sortOrder":3}]
5786248c-8d04-4ee1-b85e-f2083d2e0983	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	ألوان شائعة	COLOR	f	0	1	single	\N	\N	\N	[{"id":"f1fc991b-f49a-49dd-9508-6aa3d5d74ba4","name":"أسود","sortOrder":0},{"id":"df685c97-eee4-44da-867b-f74db008d8e9","name":"أبيض","sortOrder":1},{"id":"4d036c2e-87e3-440d-a256-24d5758bc191","name":"بيج","sortOrder":2},{"id":"3921bf0a-c000-425f-9d11-e6a31ca1988c","name":"أزرق","sortOrder":3},{"id":"fdbcac9e-7dad-409e-8550-9928ff8f8abc","name":"وردي","sortOrder":4}]
5df32ce3-9486-4155-8576-faef4545d47f	60904bcc-970a-45e3-8669-8015ee2afe64	ألوان شائعة	COLOR	f	0	1	single	\N	\N	\N	[{"id":"b02b0f5d-a63c-4ffb-becc-764f8729d543","name":"أسود","sortOrder":0},{"id":"7e28c6c7-1480-455a-81f5-5afe099468c9","name":"أبيض","sortOrder":1},{"id":"9d8a7757-49b1-4c49-9cec-407227c3085f","name":"بيج","sortOrder":2},{"id":"1a8bfd88-47d4-4a27-8b60-da6591cd3d4f","name":"أزرق","sortOrder":3},{"id":"fa467c29-6ed1-4619-9a9f-4b9f7e797f5a","name":"وردي","sortOrder":4}]
c358d252-8b92-4f5e-b02f-6d422c06b09f	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	شكولاتة	\N	t	1	1	single	\N	\N	\N	[{"id":"1a308d46-2983-402d-bf65-9407802bf176","groupId":"c358d252-8b92-4f5e-b02f-6d422c06b09f","name":"شوكلاطة بيضاء","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"eefaa9ca-183f-45c8-b528-0875b2c751ea","groupId":"c358d252-8b92-4f5e-b02f-6d422c06b09f","name":"شوكلاتة بنية","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false}]
1f168a6f-7451-400f-a6e7-a6399656faa1	f741d517-e7e6-48c9-a046-18d85acf1d25	ألوان شائعة	COLOR	f	0	1	single	\N	\N	\N	[{"id":"44933994-7920-42a2-a49c-75104db71216","name":"أسود","sortOrder":0},{"id":"8206a9d1-c597-44e4-929f-1de841a1eb9f","name":"أبيض","sortOrder":1},{"id":"52de8dd5-1c4e-42a3-81e4-194419f07afc","name":"بيج","sortOrder":2},{"id":"93d44cb3-484b-4839-975a-13d3f85701fd","name":"أزرق","sortOrder":3},{"id":"cdd83f1a-cdc0-4673-9552-3147dd156ed2","name":"وردي","sortOrder":4}]
8f8dbafc-a0f5-493e-933c-b0d4317f5807	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	اضافات	\N	t	0	3	multi	\N	\N	\N	[{"id":"2fc3955d-7eea-4fbe-bc2b-eaa5ee76850f","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"اوريو مطحون","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"b0bee7b5-f1fb-4fa0-84a9-f98a17d14836","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"لوتس مطحون","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false},{"id":"8437edb4-f4ac-486b-8e44-15e74b87f1b5","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"كليك بني","priceDelta":0,"sortOrder":2,"enabled":true,"defaultSelected":false},{"id":"1d8b4b74-6d06-4b27-8879-991443883694","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"كليك ابيض","priceDelta":0,"sortOrder":3,"enabled":true,"defaultSelected":false},{"id":"90735705-99fc-4c47-b08f-5095a6dbab7d","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"مكوبيلت بني","priceDelta":0,"sortOrder":4,"enabled":true,"defaultSelected":false},{"id":"253d8d6e-1276-45d8-b857-7b010dbfa4e9","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"مكوبيلت ابيض","priceDelta":0,"sortOrder":5,"enabled":true,"defaultSelected":false},{"id":"a250c44e-d977-46d9-b0a1-a46e2502618a","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"الدببة الصمغية","priceDelta":0,"sortOrder":6,"enabled":true,"defaultSelected":false},{"id":"5bd9fc6f-1fe5-49c4-87c7-304bc5f33b64","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"ملبس ملون","priceDelta":0,"sortOrder":7,"enabled":true,"defaultSelected":false},{"id":"c017f244-73fc-4df2-a147-c4724f30302e","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"الفول سوداني بوتنيم","priceDelta":0,"sortOrder":8,"enabled":true,"defaultSelected":false}]
\.


--
-- Data for Name: CatalogProduct; Type: TABLE DATA; Schema: public; Owner: nmd
--

COPY public."CatalogProduct" (id, "tenantId", "categoryId", name, slug, description, type, "basePrice", currency, "imageUrl", images, "optionGroups", variants, stock, "isAvailable", "createdAt", "isFeatured", "isArchived", "sortOrder") FROM stdin;
svc-lawyer-003	a7b8c9d0-e1f2-4a3b-8c9d-0e1f2a3b4c5d	cat-lawyer-001	التمثيل في المحاكم	court-representation	تمثيل قانوني في المحاكم بجميع درجاتها	GENERAL	0	ILS		[{"id":"img-3","url":"","sortOrder":0}]	[]	\N	\N	t	2026-03-01T12:00:00.000Z	t	\N	2
71993b5b-c3c0-4c67-9de9-6a825f2787d7	5b35539f-90e1-49cc-8c32-8d26cdce20f2	82a1f61b-eee2-4ed5-890d-8cf32b4e2151	jeans new collection	jeans new collection	\N	APPAREL	160	SAR	https://nmd.marketing/api/uploads/1772759320410-tmvm9rzx.webp	[{"id":"354e1528-f88d-410b-a5c8-c87c054e1f24","url":"https://nmd.marketing/api/uploads/1772759320410-tmvm9rzx.webp","sortOrder":0}]	[{"id":"3340ab1c-5e79-46bd-b128-9bf94926b5e7","name":"مقاس","type":"SIZE","required":true,"minSelected":1,"maxSelected":1,"selectionType":"single","items":[{"id":"821cb6c4-2d96-44e5-8ab2-4666556085f3","name":"36","sortOrder":0},{"id":"8a15d3ab-3688-42a0-9a85-c68bd5449221","name":"38","sortOrder":1}]}]	[]	6	t	2026-02-13T16:16:13.802Z	f	f	0
8f2231fd-b4a2-4b43-b35b-50a6392f3298	5b35539f-90e1-49cc-8c32-8d26cdce20f2	470a17ec-8b2f-41d5-9e60-ce9077ae644c	white jacket	white jacket	قماش ناعم	APPAREL	270	SAR	https://nmd.marketing/api/uploads/1772759292885-jrjejddu.webp	[{"id":"6ee65cbd-335d-42ae-9edf-3b440c608337","url":"https://nmd.marketing/api/uploads/1772759292885-jrjejddu.webp","sortOrder":0}]	[{"id":"e345456e-2425-49b9-959d-c67b8bfe8efc","name":"","type":"SIZE","required":true,"minSelected":1,"maxSelected":1,"selectionType":"single","items":[]}]	[]	6	t	2026-02-13T16:18:16.998Z	f	f	0
2a939e4c-d6cc-47ff-8d3c-a7b844121774	5b35539f-90e1-49cc-8c32-8d26cdce20f2	470a17ec-8b2f-41d5-9e60-ce9077ae644c	jeans jacket	jeans jacket	\N	APPAREL	220	SAR	https://nmd.marketing/api/uploads/1772759300231-p6785zer.webp	[{"id":"da98f6ad-865c-4496-9ecf-15379ce80230","url":"https://nmd.marketing/api/uploads/1772759300231-p6785zer.webp","sortOrder":0}]	[{"id":"eee67cd7-1cd2-445e-8e2e-d0ccb307dd1a","name":"","type":"SIZE","required":true,"minSelected":1,"maxSelected":1,"selectionType":"single","items":[{"id":"12f4d808-c6ef-4ed3-a5f8-082b8f8fc57b","name":"xl","sortOrder":0},{"id":"c4ac47ec-17a5-40b9-b0c6-d14ee9811a14","name":"m","sortOrder":1},{"id":"bf9ca34e-bbbd-4a2d-8664-993be425124a","name":"s","sortOrder":2}]}]	[]	8	t	2026-02-13T16:19:13.632Z	f	f	0
b614ea42-0af4-46bf-8975-817e6ea34a7f	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	cad82514-655f-4682-9ad8-24839dc45e8f	huda beauty powder	huda beauty powder	\N	SIMPLE	225	ILS	https://nmd.marketing/api/uploads/1772760178949-2sb0ybbz.webp	[{"id":"4bc7fa2a-481b-4700-8b18-efe024c2ba2e","url":"https://nmd.marketing/api/uploads/1772760178949-2sb0ybbz.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:23:00.589Z	f	f	1
ff4a8682-cc54-47a3-86ce-e70c820eb4f6	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	cad82514-655f-4682-9ad8-24839dc45e8f	patrick ta blush	patrick ta blush	\N	SIMPLE	220	ILS	https://nmd.marketing/api/uploads/1772760207441-q3p5opgo.webp	[{"id":"5ab9ca95-2cf3-4f80-b7b7-b59348c5e503","url":"https://nmd.marketing/api/uploads/1772760207441-q3p5opgo.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:23:29.051Z	f	f	2
70657a7a-d0ae-41e3-b233-b4e07bbc8218	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	cad82514-655f-4682-9ad8-24839dc45e8f	Dior lip oil	Dior lip oil	\N	SIMPLE	185	ILS	https://nmd.marketing/api/uploads/1772760234204-feoijrm9.webp	[{"id":"e0780178-0954-4af7-ad59-7b30da2ed53c","url":"https://nmd.marketing/api/uploads/1772760234204-feoijrm9.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:23:57.477Z	f	f	3
7e297836-90bc-4739-bf2d-4ee2c085d152	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	cad82514-655f-4682-9ad8-24839dc45e8f	Dior highlighter paette	Dior highlighter paette	\N	SIMPLE	245	ILS	https://nmd.marketing/api/uploads/1772760277861-zj00ds4z.webp	[{"id":"9a19929a-128a-409e-b1ec-94b305e66ec9","url":"https://nmd.marketing/api/uploads/1772760277861-zj00ds4z.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:24:42.552Z	f	f	4
db960671-552c-49ad-9678-4f6760df93e1	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	cad82514-655f-4682-9ad8-24839dc45e8f	Dior eye palette	Dior eye palette	\N	SIMPLE	265	ILS	https://nmd.marketing/api/uploads/1772760312523-jmdok1gg.webp	[{"id":"cb5fc2e3-5bd2-486f-86e4-d24436bccca8","url":"https://nmd.marketing/api/uploads/1772760312523-jmdok1gg.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:25:13.596Z	f	f	5
cd34e459-2ccc-4e17-9efa-f0adcb85c00a	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	cad82514-655f-4682-9ad8-24839dc45e8f	Huda beauty gloss	Huda beauty gloss	\N	SIMPLE	160	ILS	https://nmd.marketing/api/uploads/1772760345468-rrdrrjkk.webp	[{"id":"cad39e94-6f54-4d2c-a3e2-0ede7d1e3cd3","url":"https://nmd.marketing/api/uploads/1772760345468-rrdrrjkk.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:25:46.386Z	f	f	6
2c1ca24d-582d-4c99-a797-9c7c55664d69	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	cad82514-655f-4682-9ad8-24839dc45e8f	Makeup forever palette	Makeup forever palette	\N	SIMPLE	550	ILS	https://nmd.marketing/api/uploads/1772760379135-g5v3dg89.webp	[{"id":"c2fe97bc-47b1-4280-ba37-9ce1c44608fb","url":"https://nmd.marketing/api/uploads/1772760379135-g5v3dg89.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:26:20.008Z	f	f	7
a0639b25-cb04-46ec-8757-434558f90f7a	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	cad82514-655f-4682-9ad8-24839dc45e8f	Huda beauty primer	Huda beauty primer	\N	SIMPLE	215	ILS	https://nmd.marketing/api/uploads/1772760514817-r345ngmn.webp	[{"id":"8b988d58-62af-4984-8efd-39ffde5d5994","url":"https://nmd.marketing/api/uploads/1772760514817-r345ngmn.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:27:01.342Z	f	f	8
6099cd8a-1eac-4ec2-985f-9977b5a9afc0	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	cad82514-655f-4682-9ad8-24839dc45e8f	patrick ta blush	patrick ta blush	\N	SIMPLE	220	ILS	https://nmd.marketing/api/uploads/1772760550480-9vy6cx43.webp	[{"id":"7f2d7305-d155-41cb-89e1-0c10122e3191","url":"https://nmd.marketing/api/uploads/1772760550480-9vy6cx43.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:29:11.771Z	f	f	9
e5ee2725-3652-492c-84ce-4b0e9f043a2c	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2fa37ae7-56e8-4bee-a59f-a5de98e66f55	blue day	blue day	\N	SIMPLE	5	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:41:11.431Z	f	f	79
svc-lawyer-002	a7b8c9d0-e1f2-4a3b-8c9d-0e1f2a3b4c5d	cat-lawyer-001	صياغة العقود	contract-drafting	صياغة ومراجعة العقود بكافة أنواعها	GENERAL	0	ILS		[{"id":"img-2","url":"","sortOrder":0}]	[]	\N	\N	t	2026-03-01T12:00:00.000Z	t	\N	1
0f71a73e-d702-4805-b13e-b49c6f39a976	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	cad82514-655f-4682-9ad8-24839dc45e8f	tarte concealer	tarte concealer	\N	SIMPLE	160	ILS	https://nmd.marketing/api/uploads/1772760792148-pnnrp6zh.webp	[{"id":"9ea8758d-9743-4ef3-833a-f4a62e373957","url":"https://nmd.marketing/api/uploads/1772760792148-pnnrp6zh.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:33:14.132Z	f	f	14
74e3eddd-6e33-4637-922c-9cbeee1c6399	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	cad82514-655f-4682-9ad8-24839dc45e8f	the ordinary toner	the ordinary toner	\N	SIMPLE	135	ILS	https://nmd.marketing/api/uploads/1772760824986-x86q5fxy.webp	[{"id":"c6948fd4-17e6-409b-bc21-ca481f50cabe","url":"https://nmd.marketing/api/uploads/1772760824986-x86q5fxy.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:33:46.032Z	f	f	15
0a5e874f-3836-4f25-a0b4-5c9986c1dfa5	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	cad82514-655f-4682-9ad8-24839dc45e8f	huda beauty foundation	huda beauty foundation	\N	SIMPLE	215	ILS	https://nmd.marketing/api/uploads/1772760861780-2kho9487.webp	[{"id":"e8ae71a7-47a1-4980-914a-dbde5902448b","url":"https://nmd.marketing/api/uploads/1772760861780-2kho9487.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:34:22.908Z	f	f	16
3fad7a49-ccff-44b9-b42c-4883815309a4	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	cad82514-655f-4682-9ad8-24839dc45e8f	huda beaty mascara	huda beaty mascara	\N	SIMPLE	150	ILS	https://nmd.marketing/api/uploads/1772760951664-jakslo71.webp	[{"id":"ad833e0b-cbb4-4a55-971d-e96b9b88a6d9","url":"https://nmd.marketing/api/uploads/1772760951664-jakslo71.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:35:52.724Z	f	f	18
a47157a1-e091-4242-bbbd-5545d5e6ee50	1cc59722-3687-45a1-9121-e7a608fba225	15a1b5ad-bd38-4fb5-b948-7962f9755463	بيتسا صغير	بيتسا صغير	\N	SIMPLE	25	ILS	https://nmd.marketing/api/uploads/1772734525734-bbtvv9l2.webp	[{"id":"2886f7da-3bcd-4169-ac23-ccd49240e94d","url":"https://nmd.marketing/api/uploads/1772734525734-bbtvv9l2.webp","sortOrder":0}]	[{"id":"dc9108b1-95c5-4ea1-b0cb-6541a16fb88e","name":"اضافات","type":"CUSTOM","required":true,"minSelected":1,"maxSelected":1,"selectionType":"single","items":[]}]	[]	\N	t	2026-03-05T18:15:43.056Z	f	f	2
prod-drawshe-1	1c6f3866-a475-445e-8806-42065adea654	cat-drawshe-1	استشارة قانونية	legal-consultation	\N	GENERAL	0	ILS		[]	[]	[]	\N	t	\N	\N	\N	0
4e406eb4-05fd-4281-96bc-11443246f69c	6d59233f-5edd-463b-b379-2697e5b6df34	fba36c55-c38e-451b-b73b-7ce91a3ba575	صفيحة لحمة	صفيحة لحمة	\N	SIMPLE	20	ILS	https://nmd.marketing/api/uploads/1772732742491-32fnt29n.webp	[{"id":"60fd5648-7f67-4f91-8662-2a25e8b5e879","url":"https://nmd.marketing/api/uploads/1772732742491-32fnt29n.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T17:45:44.934Z	f	f	1
2c6b2250-18d2-45d9-8127-c412358e5e5d	6d59233f-5edd-463b-b379-2697e5b6df34	fba36c55-c38e-451b-b73b-7ce91a3ba575	صفيحة دجاج	صفيحة دجاج	\N	SIMPLE	20	ILS	https://nmd.marketing/api/uploads/1772733073943-h1kqwa5s.webp	[{"id":"9c404c41-6884-413d-8855-30dbe3a66971","url":"https://nmd.marketing/api/uploads/1772733073943-h1kqwa5s.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T17:51:16.857Z	f	f	2
1bd2d51e-8454-466e-a856-06564a60095b	6d59233f-5edd-463b-b379-2697e5b6df34	fba36c55-c38e-451b-b73b-7ce91a3ba575	زعتر وجبنة	زعتر وجبنة	\N	SIMPLE	8	ILS	https://nmd.marketing/api/uploads/1772733106492-leaipg38.webp	[{"id":"ac07da76-16f7-4b9e-a772-2209fa7c7456","url":"https://nmd.marketing/api/uploads/1772733106492-leaipg38.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T17:51:48.513Z	f	f	3
d7505147-c27b-4bd7-bfcf-b07fe386f58c	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	cad82514-655f-4682-9ad8-24839dc45e8f	too faced concealer	too faced concealer	\N	SIMPLE	170	ILS	https://nmd.marketing/api/uploads/1772760646036-nhpjl45m.webp	[{"id":"d6aa0878-c656-472e-9d87-95d24d4e2cd2","url":"https://nmd.marketing/api/uploads/1772760646036-nhpjl45m.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:30:47.254Z	f	f	11
6fdea776-1f3c-4c4b-b7c6-48237e6bd213	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	cad82514-655f-4682-9ad8-24839dc45e8f	makeup by mario contour	makeup by mario contour	\N	SIMPLE	190	ILS	https://nmd.marketing/api/uploads/1772760710103-dp6lv8zj.webp	[{"id":"56bcaa61-0ff7-4fd5-a86f-04c191d6287d","url":"https://nmd.marketing/api/uploads/1772760710103-dp6lv8zj.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:31:52.081Z	f	f	12
f3b56f34-e83e-4af4-a83f-9f3ae443db84	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	cad82514-655f-4682-9ad8-24839dc45e8f	huda beauty puffs	huda beauty puffs	\N	SIMPLE	115	ILS	https://nmd.marketing/api/uploads/1772760750111-3t0bfxrb.webp	[{"id":"1fa793fb-aba8-4edf-909c-ed74d3a5a7d9","url":"https://nmd.marketing/api/uploads/1772760750111-3t0bfxrb.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:32:32.048Z	f	f	13
4a16571a-64fa-4444-93f2-5a6c9147a2b1	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	cad82514-655f-4682-9ad8-24839dc45e8f	chanel gloss	chanel gloss	\N	SIMPLE	200	ILS	https://nmd.marketing/api/uploads/1772760914807-1ptlctq1.webp	[{"id":"611a5ffe-5f6c-4544-bb92-df6eff16b1c6","url":"https://nmd.marketing/api/uploads/1772760914807-1ptlctq1.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:35:15.964Z	f	f	17
ebd61bdd-2481-4626-b176-f703dba68633	6d59233f-5edd-463b-b379-2697e5b6df34	fba36c55-c38e-451b-b73b-7ce91a3ba575	بيتسا ببروني	بيتسا ببروني	\N	SIMPLE	15	ILS	https://nmd.marketing/api/uploads/1772733190740-i706h6m3.webp	[{"id":"58fff34d-3e35-4761-b32f-e99a53660ced","url":"https://nmd.marketing/api/uploads/1772733190740-i706h6m3.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T17:53:13.136Z	f	f	6
2d1eb85c-6c21-407a-9f9f-3cda3f395779	6d59233f-5edd-463b-b379-2697e5b6df34	fba36c55-c38e-451b-b73b-7ce91a3ba575	زعتر	زعتر	\N	SIMPLE	5	ILS	https://nmd.marketing/api/uploads/1772733123969-2r5r4tyi.webp	[{"id":"c5adcc87-0694-4b03-8c06-7b8a5f0fff49","url":"https://nmd.marketing/api/uploads/1772733123969-2r5r4tyi.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T17:52:05.632Z	f	f	4
51b1f8f9-e7a6-4d6d-b90e-466447c30cac	6d59233f-5edd-463b-b379-2697e5b6df34	fba36c55-c38e-451b-b73b-7ce91a3ba575	جبنة بيضاء	جبنة بيضاء	\N	SIMPLE	7	ILS	https://nmd.marketing/api/uploads/1772733287719-vgmpzvhx.webp	[{"id":"ce859dfd-1016-43cf-ac35-fada5a40699a","url":"https://nmd.marketing/api/uploads/1772733287719-vgmpzvhx.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T17:54:48.815Z	f	f	7
3ff367a1-4e74-4f0a-aefa-98b1933c9bd6	6d59233f-5edd-463b-b379-2697e5b6df34	fba36c55-c38e-451b-b73b-7ce91a3ba575	لبنة	لبنة	\N	SIMPLE	10	ILS	https://nmd.marketing/api/uploads/1772733310869-jpo33w9z.webp	[{"id":"c95eae9f-e37c-42cf-bf1e-8a0414a10e23","url":"https://nmd.marketing/api/uploads/1772733310869-jpo33w9z.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T17:55:12.849Z	f	f	8
1526c931-76a8-4994-ad0c-b87cbb3b1a88	6d59233f-5edd-463b-b379-2697e5b6df34	fba36c55-c38e-451b-b73b-7ce91a3ba575	فوكاتشا	فوكاتشا	\N	SIMPLE	15	ILS	https://nmd.marketing/api/uploads/1772733361674-qjvzo89r.webp	[{"id":"b8121b0b-fd56-4292-93f7-b40791170799","url":"https://nmd.marketing/api/uploads/1772733361674-qjvzo89r.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T17:56:03.023Z	f	f	10
a24b446f-328c-4831-841c-8433f4bed5ab	6d59233f-5edd-463b-b379-2697e5b6df34	fba36c55-c38e-451b-b73b-7ce91a3ba575	شنيتسل	شنيتسل	\N	SIMPLE	25	ILS	https://nmd.marketing/api/uploads/1772733384040-f6ujcbgn.webp	[{"id":"df19e67f-48ad-4809-bc37-be41cb51f9f4","url":"https://nmd.marketing/api/uploads/1772733384040-f6ujcbgn.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T17:56:25.186Z	f	f	11
67ff235f-cd85-4f40-8da8-293121d3e645	6d59233f-5edd-463b-b379-2697e5b6df34	fba36c55-c38e-451b-b73b-7ce91a3ba575	نكنكيوت	نكنكيوت	\N	SIMPLE	10	ILS	https://nmd.marketing/api/uploads/1772733437255-eobjbcca.webp	[{"id":"6e3e714b-3b51-4453-b3f3-1bee2ea645fc","url":"https://nmd.marketing/api/uploads/1772733437255-eobjbcca.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T17:57:18.840Z	f	f	13
39a2cb24-eeaf-420c-b6d3-b720f01f21d7	0c36235a-9473-4226-b091-71e3fb0efdc5	07fc715f-c51a-4774-b698-02cecbb39009	فوكاتشا بيتسا	فوكاتشا بيتسا	\N	SIMPLE	20	ILS	https://nmd.marketing/api/uploads/1772745286393-d23rfz4r.webp	[{"id":"1edad80f-eacf-486c-99c3-bc0b9bdb962c","url":"https://nmd.marketing/api/uploads/1772745286393-d23rfz4r.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T21:14:47.900Z	f	f	9
7373526c-d85f-45aa-a656-66c056587387	6d59233f-5edd-463b-b379-2697e5b6df34	fba36c55-c38e-451b-b73b-7ce91a3ba575	صدر دجاج	صدر دجاج	\N	SIMPLE	25	ILS	https://nmd.marketing/api/uploads/1772733410419-975us7oh.webp	[{"id":"f97962e2-f61d-4665-9f39-887d7a2fd65f","url":"https://nmd.marketing/api/uploads/1772733410419-975us7oh.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T17:56:52.386Z	f	f	12
d4187b64-4d10-4cf9-937c-facdc8dfa0a2	6d59233f-5edd-463b-b379-2697e5b6df34	fba36c55-c38e-451b-b73b-7ce91a3ba575	بستراما	بستراما	\N	SIMPLE	12	ILS	https://nmd.marketing/api/uploads/1772733483893-zuyc0g7l.webp	[{"id":"0ebf5f11-bb50-4c47-805f-0884278956ee","url":"https://nmd.marketing/api/uploads/1772733483893-zuyc0g7l.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T17:58:06.464Z	f	f	15
97a7e421-c621-41a0-b872-7d4c25dba081	6d59233f-5edd-463b-b379-2697e5b6df34	fba36c55-c38e-451b-b73b-7ce91a3ba575	عجة	عجة	\N	SIMPLE	20	ILS	https://nmd.marketing/api/uploads/1772733508324-o69dx9gq.webp	[{"id":"989bb2c7-c0c6-45dc-9514-cbb7692addc1","url":"https://nmd.marketing/api/uploads/1772733508324-o69dx9gq.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T17:58:30.062Z	f	f	16
90911ead-c206-4aeb-90f9-b643465085b1	6d59233f-5edd-463b-b379-2697e5b6df34	fba36c55-c38e-451b-b73b-7ce91a3ba575	توست جبنة	توست جبنة	\N	SIMPLE	15	ILS	https://nmd.marketing/api/uploads/1772733536184-w6gqaqso.webp	[{"id":"37699b71-dbe6-4413-85eb-94b71f5daf5a","url":"https://nmd.marketing/api/uploads/1772733536184-w6gqaqso.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T17:58:57.270Z	f	f	17
45d1a8ea-945b-4e11-ace2-50ea533aa1fa	0c36235a-9473-4226-b091-71e3fb0efdc5	07fc715f-c51a-4774-b698-02cecbb39009	فوكاتشا عجل	فوكاتشا عجل	لحمة عجل مفرومة مع صوص وقطع فليفلة	SIMPLE	25	ILS	https://nmd.marketing/api/uploads/1772744211050-l7xz315z.webp	[{"id":"7e706571-7b19-4950-ab4f-ac2809e9e3ca","url":"https://nmd.marketing/api/uploads/1772744211050-l7xz315z.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T20:57:06.355Z	f	f	1
6f08b22b-c085-4a4d-8ae6-503af2ce4d8b	0c36235a-9473-4226-b091-71e3fb0efdc5	07fc715f-c51a-4774-b698-02cecbb39009	فوكاتشا دجاج	فوكاتشا دجاج	دجاج مقطع مع صوص وقطع فليفلة	SIMPLE	25	ILS	https://nmd.marketing/api/uploads/1772744262365-ysvp6az3.webp	[{"id":"9d0820ee-be1e-4cf5-9553-1387fe67312c","url":"https://nmd.marketing/api/uploads/1772744262365-ysvp6az3.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T20:57:45.082Z	f	f	2
d883fce6-585a-4fbd-82d5-507f6ff0d292	0c36235a-9473-4226-b091-71e3fb0efdc5	07fc715f-c51a-4774-b698-02cecbb39009	فوكاتشا خضار	فوكاتشا خضار	فوكاتشا مع تشكيلة خضار طازة وخلطة اجبان	SIMPLE	25	ILS	https://nmd.marketing/api/uploads/1772744402969-rq8o32xt.webp	[{"id":"f91df4cf-5822-4605-9612-96241ccf99b7","url":"https://nmd.marketing/api/uploads/1772744402969-rq8o32xt.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T21:00:05.442Z	f	f	3
0d0b0d7b-67e6-490a-856f-63ac2e066cd9	0c36235a-9473-4226-b091-71e3fb0efdc5	07fc715f-c51a-4774-b698-02cecbb39009	فوكاتشا مثومة	فوكاتشا مثومة	فوكاتشا بصوص الثوم مع حبات الثوم والبندورة	SIMPLE	15	ILS	https://nmd.marketing/api/uploads/1772744511093-amqijvfe.webp	[{"id":"bd892cc9-6788-453c-9775-91511ede4fcf","url":"https://nmd.marketing/api/uploads/1772744511093-amqijvfe.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T21:01:54.006Z	f	f	4
44ab7390-0c93-4da8-89f3-b31a40f1b98f	0c36235a-9473-4226-b091-71e3fb0efdc5	07fc715f-c51a-4774-b698-02cecbb39009	فوكاتش افوكادو	فوكاتش افوكادو	خلطة افوكادو بنكهة خيالية مع قطع البيض	SIMPLE	25	ILS	https://nmd.marketing/api/uploads/1772744580773-ui7kcoql.webp	[{"id":"a70af60a-7cab-4a9a-a408-2969a7112f1b","url":"https://nmd.marketing/api/uploads/1772744580773-ui7kcoql.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T21:03:02.363Z	f	f	5
19468b5d-d95f-41d2-999c-89e7d7171002	0c36235a-9473-4226-b091-71e3fb0efdc5	07fc715f-c51a-4774-b698-02cecbb39009	فوكاتشا جبنة عربية 	فوكاتشا جبنة عربية 	\N	SIMPLE	20	ILS	https://nmd.marketing/api/uploads/1772744651682-jr8j2529.webp	[{"id":"cc2bbf06-2150-40ff-ba3d-56e85d0ff6d6","url":"https://nmd.marketing/api/uploads/1772744651682-jr8j2529.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T21:04:14.373Z	f	f	6
506200a8-ce49-4cd8-b8de-3cc4cbffa672	0c36235a-9473-4226-b091-71e3fb0efdc5	07fc715f-c51a-4774-b698-02cecbb39009	بوركس  جبنة/بطاطا	بوركس  جبنة/بطاطا	يقدم مع مخللات بيضة وصوص بندورة	SIMPLE	25	ILS	https://nmd.marketing/api/uploads/1772744944263-vq632xr5.webp	[{"id":"29bceca4-21eb-44ad-8607-fc0fc8501fd7","url":"https://nmd.marketing/api/uploads/1772744944263-vq632xr5.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T21:09:07.545Z	f	f	8
1fa3216b-d811-4bae-a8ef-ddd7fd23c412	f6e493da-e69f-4bbc-877b-8842a1dfb72e	94f42e0b-25c3-406d-8a58-d02613b74358	صفيحة لحمة	صفيحة لحمة	\N	SIMPLE	35	ILS	https://nmd.marketing/api/uploads/1772759616200-uz2h5dno.webp	[{"id":"501ba80b-fd42-4252-9305-de2dfbc174de","url":"https://nmd.marketing/api/uploads/1772759616200-uz2h5dno.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:13:40.110Z	f	f	1
55c2a3db-6cf1-4593-88f1-86efe6e2ca79	6d59233f-5edd-463b-b379-2697e5b6df34	fba36c55-c38e-451b-b73b-7ce91a3ba575	ابوكادو	ابوكادو	\N	SIMPLE	12	ILS	https://nmd.marketing/api/uploads/1772733331059-6lms1w1v.webp	[{"id":"8b0c9a41-1862-45c0-85ce-14be6501706d","url":"https://nmd.marketing/api/uploads/1772733331059-6lms1w1v.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T17:55:35.737Z	f	f	9
f68f812c-ee66-4b0a-916d-edcde7ed53a8	6d59233f-5edd-463b-b379-2697e5b6df34	fba36c55-c38e-451b-b73b-7ce91a3ba575	سلامي	سلامي	\N	SIMPLE	12	ILS	https://nmd.marketing/api/uploads/1772733461457-eh5ogbmt.webp	[{"id":"38b69417-0f95-45a8-9264-699c88d7cd82","url":"https://nmd.marketing/api/uploads/1772733461457-eh5ogbmt.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T17:57:43.248Z	f	f	14
ee67096c-e284-4799-9a71-d240f3b693b2	f6e493da-e69f-4bbc-877b-8842a1dfb72e	94f42e0b-25c3-406d-8a58-d02613b74358	بيتزا	بيتزا	\N	SIMPLE	25	ILS	https://nmd.marketing/api/uploads/1772759673922-wzcew3z6.webp	[{"id":"94725e27-540c-4b4d-8f3b-e1cbed9f6c3a","url":"https://nmd.marketing/api/uploads/1772759673922-wzcew3z6.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:14:38.761Z	f	f	4
2e8eeeb2-afa7-47f1-8b06-0f45e480d103	f6e493da-e69f-4bbc-877b-8842a1dfb72e	94f42e0b-25c3-406d-8a58-d02613b74358	لبنة	لبنة	\N	SIMPLE	20	ILS	https://nmd.marketing/api/uploads/1772759700762-3wtcawvf.webp	[{"id":"abd2a49f-cbf0-4152-a543-556c1466f26b","url":"https://nmd.marketing/api/uploads/1772759700762-3wtcawvf.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:15:02.418Z	f	f	5
8afd0c41-ae6d-45ee-9be0-fb001a280e9e	f6e493da-e69f-4bbc-877b-8842a1dfb72e	94f42e0b-25c3-406d-8a58-d02613b74358	زعتر	زعتر	\N	SIMPLE	15	ILS	https://nmd.marketing/api/uploads/1772759719353-9i7653x6.webp	[{"id":"a15bc5ee-89aa-4985-ac79-c6638a5df971","url":"https://nmd.marketing/api/uploads/1772759719353-9i7653x6.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:15:20.354Z	f	f	6
4c38c94e-0526-4b82-b127-23e2b8a627ad	2f663230-f9b3-463c-b8ab-eb55a5474b95	3f72a4ff-f5e3-428a-adca-467321eb9e83	قشطوطة	قشطوطة	\N	SIMPLE	35	ILS	https://nmd.marketing/api/uploads/1772871518669-085vcwqe.webp	[{"id":"275177f4-a3c3-4452-9af8-441d11d33cc7","url":"https://nmd.marketing/api/uploads/1772871518669-085vcwqe.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:18:49.870Z	f	f	0
c4dc4eba-662b-4e2c-99d3-b3522f237b07	2f663230-f9b3-463c-b8ab-eb55a5474b95	3f72a4ff-f5e3-428a-adca-467321eb9e83	قشطوطة  شوكلاتة	قشطوطة  شوكلاتة	\N	SIMPLE	35	ILS	https://nmd.marketing/api/uploads/1772871647874-abh9uds8.webp	[{"id":"a4b815ac-1959-45bc-86c2-3021e802f4d4","url":"https://nmd.marketing/api/uploads/1772871647874-abh9uds8.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:20:48.465Z	f	f	2
b460dda3-237e-4d6f-9397-51e863b9d9e3	2f663230-f9b3-463c-b8ab-eb55a5474b95	3f72a4ff-f5e3-428a-adca-467321eb9e83	قطشوطة لوتوس	قطشوطة لوتوس	\N	SIMPLE	35	ILS	https://nmd.marketing/api/uploads/1772871664878-hy13kvcf.webp	[{"id":"5d63018a-19c7-4f33-a620-2f458521bfb6","url":"https://nmd.marketing/api/uploads/1772871664878-hy13kvcf.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:21:08.466Z	f	f	3
66c097f7-c6c3-41cb-a6e0-72f16b373ae3	2f663230-f9b3-463c-b8ab-eb55a5474b95	3f72a4ff-f5e3-428a-adca-467321eb9e83	قشطوطة اوريو	قشطوطة اوريو	\N	SIMPLE	35	ILS	https://nmd.marketing/api/uploads/1772871687432-la5t1nnr.webp	[{"id":"ce94e82e-2a31-4527-bf35-f504741021b6","url":"https://nmd.marketing/api/uploads/1772871687432-la5t1nnr.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:21:27.917Z	f	f	4
1e3fa4d2-b59e-4d91-87cf-db7eb0d43696	2f663230-f9b3-463c-b8ab-eb55a5474b95	3f72a4ff-f5e3-428a-adca-467321eb9e83	قشطوطة شوفان وعسل	قشطوطة شوفان وعسل	\N	SIMPLE	35	ILS	https://nmd.marketing/api/uploads/1772871708402-jmci5ykb.webp	[{"id":"7ba4debe-b828-489b-bb8e-27be1089cb2b","url":"https://nmd.marketing/api/uploads/1772871708402-jmci5ykb.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:21:51.104Z	f	f	5
c2fc1b22-b701-44e9-a569-f3a9099825f3	2f663230-f9b3-463c-b8ab-eb55a5474b95	3f72a4ff-f5e3-428a-adca-467321eb9e83	قشطوطة خلابيصة	قشطوطة خلابيصة	\N	SIMPLE	35	ILS	https://nmd.marketing/api/uploads/1772871728149-t8he7jlc.webp	[{"id":"958de17f-348e-4f97-af80-940ca41dfee6","url":"https://nmd.marketing/api/uploads/1772871728149-t8he7jlc.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:22:08.778Z	f	f	6
56b9c255-aa12-4edd-a988-7ed9a751d47e	2f663230-f9b3-463c-b8ab-eb55a5474b95	3f72a4ff-f5e3-428a-adca-467321eb9e83	قشطوطة دبي	قشطوطة دبي	\N	SIMPLE	35	ILS	https://nmd.marketing/api/uploads/1772871745918-w7is157f.webp	[{"id":"0a243516-3328-4586-b068-068487eeed53","url":"https://nmd.marketing/api/uploads/1772871745918-w7is157f.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:22:27.168Z	f	f	7
f3c3757e-3837-4fcb-96bd-2a02569eebf0	2f663230-f9b3-463c-b8ab-eb55a5474b95	3f72a4ff-f5e3-428a-adca-467321eb9e83	قشطوطة لوليتا	قشطوطة لوليتا	\N	SIMPLE	35	ILS	https://nmd.marketing/api/uploads/1772871770622-naea7xp6.webp	[{"id":"d20f2a03-055c-4eae-9959-080982126c17","url":"https://nmd.marketing/api/uploads/1772871770622-naea7xp6.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:22:51.112Z	f	f	8
6c558940-d9ef-47c0-99cc-32ececc591b7	2f663230-f9b3-463c-b8ab-eb55a5474b95	3f72a4ff-f5e3-428a-adca-467321eb9e83	قشطوطة اللؤوة	قشطوطة اللؤوة	\N	SIMPLE	35	ILS	https://nmd.marketing/api/uploads/1772871792672-uoabhkfp.webp	[{"id":"a169c805-09be-4be5-affb-cc0aa3be3ce7","url":"https://nmd.marketing/api/uploads/1772871792672-uoabhkfp.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:23:13.592Z	f	f	9
fdbe5f89-e977-41ad-85c6-20a84d411f19	2f663230-f9b3-463c-b8ab-eb55a5474b95	3f72a4ff-f5e3-428a-adca-467321eb9e83	كشري	كشري	\N	SIMPLE	35	ILS	https://nmd.marketing/api/uploads/1772871863770-3j8mo4e5.webp	[{"id":"79c2befa-dd0c-4900-ade2-0a95e1933836","url":"https://nmd.marketing/api/uploads/1772871863770-3j8mo4e5.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:24:24.885Z	f	f	10
f16d5ed3-0ab7-4a6d-a8d1-0b7f800ebe23	2f663230-f9b3-463c-b8ab-eb55a5474b95	3f72a4ff-f5e3-428a-adca-467321eb9e83	اه يا لندن	اه يا لندن	\N	SIMPLE	30	ILS	https://nmd.marketing/api/uploads/1772871917024-vzhosjow.webp	[{"id":"c51ed7ea-97db-4795-a2e9-a35cd67e017d","url":"https://nmd.marketing/api/uploads/1772871917024-vzhosjow.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:25:17.821Z	f	f	11
78c97f64-b3b4-4ad1-9aad-7bbd749abb44	2f663230-f9b3-463c-b8ab-eb55a5474b95	3f72a4ff-f5e3-428a-adca-467321eb9e83	دباديبو	دباديبو	\N	SIMPLE	30	ILS	https://nmd.marketing/api/uploads/1772872600676-t5f5rq87.webp	[{"id":"2fa5b2e4-6f54-4e3a-84c8-a28a426fa43b","url":"https://nmd.marketing/api/uploads/1772872600676-t5f5rq87.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:36:41.027Z	f	f	12
82d13274-25c8-4c8f-88fd-01fdcee6d9b6	f6e493da-e69f-4bbc-877b-8842a1dfb72e	94f42e0b-25c3-406d-8a58-d02613b74358	بيتزا ببروني	بيتزا ببروني	\N	SIMPLE	30	ILS	https://nmd.marketing/api/uploads/1772759655903-nmprfwnt.webp	[{"id":"2b3cdc46-a345-4341-a05b-998c906ed095","url":"https://nmd.marketing/api/uploads/1772759655903-nmprfwnt.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:14:16.483Z	f	f	3
9ae3c89a-ae3c-48b7-834c-b403186c81a9	2f663230-f9b3-463c-b8ab-eb55a5474b95	0a915473-a6f3-4438-bb08-fc143a46d943	موخيتو فواكه استوائية	موخيتو فواكه استوائية	\N	SIMPLE	22	ILS	https://nmd.marketing/api/uploads/1772871965384-31w5jr8f.webp	[{"id":"13fd1c84-6294-41d4-8548-9b0c1d1135d2","url":"https://nmd.marketing/api/uploads/1772871965384-31w5jr8f.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:26:06.219Z	f	f	14
79563487-f4ec-490e-ad14-7b62b94755f9	2f663230-f9b3-463c-b8ab-eb55a5474b95	3f72a4ff-f5e3-428a-adca-467321eb9e83	مقدوحة نقانق	مقدوحة نقانق	\N	SIMPLE	7	ILS	https://nmd.marketing/api/uploads/1772872825169-m2kii2iw.webp	[{"id":"6e48a15a-9565-4c5c-abc8-e5ba436b3e9f","url":"https://nmd.marketing/api/uploads/1772872825169-m2kii2iw.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:40:25.490Z	f	f	14
057cfdac-faef-44d6-a32a-e850a88288e1	2f663230-f9b3-463c-b8ab-eb55a5474b95	0a915473-a6f3-4438-bb08-fc143a46d943	موخيتو توت	موخيتو توت	\N	SIMPLE	22	ILS	https://nmd.marketing/api/uploads/1772871978479-y91kvkh7.webp	[{"id":"6cdfe79d-e31d-4b29-96ae-ba3e7744bf98","url":"https://nmd.marketing/api/uploads/1772871978479-y91kvkh7.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:26:19.087Z	f	f	15
877dd9be-529c-4b95-90a3-e9b971fa17c0	2f663230-f9b3-463c-b8ab-eb55a5474b95	3f72a4ff-f5e3-428a-adca-467321eb9e83	عصير رمان طبيعي	عصير رمان طبيعي	\N	SIMPLE	23	ILS	https://nmd.marketing/api/uploads/1772874154029-cdmy24w2.webp	[{"id":"13147e85-41b6-42b9-8c2e-b5a5fcb338d1","url":"https://nmd.marketing/api/uploads/1772874154029-cdmy24w2.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T09:02:34.911Z	f	f	15
4caac2a7-a65b-4256-a9c6-c7d2abb92bd8	2f663230-f9b3-463c-b8ab-eb55a5474b95	0a915473-a6f3-4438-bb08-fc143a46d943	موخيتو بلوبيري	موخيتو بلوبيري	\N	SIMPLE	0	ILS	https://nmd.marketing/api/uploads/1772871996312-linifjkn.webp	[{"id":"e0322b9e-4563-4f84-8589-4fbf41da8f20","url":"https://nmd.marketing/api/uploads/1772871996312-linifjkn.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:26:37.185Z	f	f	16
1d45e5f8-fbf1-46d9-a0fe-c8c883dd77e9	2f663230-f9b3-463c-b8ab-eb55a5474b95	0a915473-a6f3-4438-bb08-fc143a46d943	موخيتو اناناس	موخيتو اناناس	\N	SIMPLE	22	ILS	https://nmd.marketing/api/uploads/1772872015177-pa525bw4.webp	[{"id":"ed98c340-96f9-4265-b415-d2e6631a64dc","url":"https://nmd.marketing/api/uploads/1772872015177-pa525bw4.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:26:55.790Z	f	f	17
a1bc9d24-bb1a-4805-ad6a-a56f2549293d	2f663230-f9b3-463c-b8ab-eb55a5474b95	0a915473-a6f3-4438-bb08-fc143a46d943	موخيتو تفاح	موخيتو تفاح	\N	SIMPLE	22	ILS	https://nmd.marketing/api/uploads/1772872034834-6nux7o4a.webp	[{"id":"e66346d8-72bd-4338-8b97-46bc1d26c184","url":"https://nmd.marketing/api/uploads/1772872034834-6nux7o4a.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:27:15.997Z	f	f	18
ea10f3ca-17a3-49ef-b1f8-7d55d55821d9	2f663230-f9b3-463c-b8ab-eb55a5474b95	7b43e146-2b38-4003-894a-44f1c6d127f9	موخيتو ماستك	موخيتو ماستك	\N	SIMPLE	22	ILS	https://nmd.marketing/api/uploads/1772872055973-gfxatcc6.webp	[{"id":"17db38e9-5290-4dc1-9caf-d48eec28bc04","url":"https://nmd.marketing/api/uploads/1772872055973-gfxatcc6.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:27:36.767Z	f	f	19
cc21e128-e114-4583-885e-9b14cc29dc54	2f663230-f9b3-463c-b8ab-eb55a5474b95	7b43e146-2b38-4003-894a-44f1c6d127f9	ميلك شيك توت	ميلك شيك توت	\N	SIMPLE	25	ILS	https://nmd.marketing/api/uploads/1772872094786-4bj87vyq.webp	[{"id":"b6fedd36-9738-433d-99d6-c323dab345b9","url":"https://nmd.marketing/api/uploads/1772872094786-4bj87vyq.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:28:18.443Z	f	f	21
1b04b11b-8832-40ae-b5c3-eb12a260c1e1	2f663230-f9b3-463c-b8ab-eb55a5474b95	7b43e146-2b38-4003-894a-44f1c6d127f9	ميلك شيك اوريو	ميلك شيك اوريو	\N	SIMPLE	25	ILS	https://nmd.marketing/api/uploads/1772872113070-s95cz3yl.webp	[{"id":"0ecdbc70-206f-406c-874d-b830532a819b","url":"https://nmd.marketing/api/uploads/1772872113070-s95cz3yl.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:28:33.857Z	f	f	22
7a934acf-b1f0-4c77-bc66-fe344891d3e2	2f663230-f9b3-463c-b8ab-eb55a5474b95	7b43e146-2b38-4003-894a-44f1c6d127f9	ميلك شيك فانيل	ميلك شيك فانيل	\N	SIMPLE	25	ILS	https://nmd.marketing/api/uploads/1772872133432-9kjvyfiz.webp	[{"id":"30cd042d-92f1-4066-8726-7c65696c9691","url":"https://nmd.marketing/api/uploads/1772872133432-9kjvyfiz.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:28:54.027Z	f	f	23
b36db0b1-f155-4c0a-9fcf-11f3f090ecfc	2f663230-f9b3-463c-b8ab-eb55a5474b95	7b43e146-2b38-4003-894a-44f1c6d127f9	ميلك شيك فستق حلبي	ميلك شيك فستق حلبي	\N	SIMPLE	25	ILS	https://nmd.marketing/api/uploads/1772872154497-r49v3uno.webp	[{"id":"d6d9687d-a8eb-4c69-912e-debd15f8c5eb","url":"https://nmd.marketing/api/uploads/1772872154497-r49v3uno.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:29:14.980Z	f	f	24
11c03c2d-6cbe-49ae-8629-4bf489e695c0	2f663230-f9b3-463c-b8ab-eb55a5474b95	7b43e146-2b38-4003-894a-44f1c6d127f9	فخفخينا	فخفخينا	\N	SIMPLE	25	ILS	https://nmd.marketing/api/uploads/1772872179050-80dcv7s2.webp	[{"id":"33865f8b-0998-4cd7-a837-07f2d74809f8","url":"https://nmd.marketing/api/uploads/1772872179050-80dcv7s2.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:29:43.446Z	f	f	25
fd851498-48c6-41d9-90cb-411eb014dd6a	2f663230-f9b3-463c-b8ab-eb55a5474b95	f5bfd656-d9c1-41e9-af52-41eb9b215cf9	فرفوشكا نوتيلا	فرفوشكا نوتيلا	\N	SIMPLE	35	ILS	https://nmd.marketing/api/uploads/1772872447769-ghzqrlr3.webp	[{"id":"7994833e-bb16-4f85-9947-d33a90dbf7a5","url":"https://nmd.marketing/api/uploads/1772872447769-ghzqrlr3.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:34:08.098Z	f	f	26
919d8b86-0efc-43b1-a8b6-594c4a4e8049	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	blue بطيخ	blue بطيخ	\N	SIMPLE	5	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:40:47.781Z	f	f	78
a4b9e954-c13f-4be4-948f-5e48b84c9ff1	2f663230-f9b3-463c-b8ab-eb55a5474b95	3f72a4ff-f5e3-428a-adca-467321eb9e83	سوفليه	سوفليه	\N	SIMPLE	25	ILS	https://nmd.marketing/api/uploads/1772872685931-uxgkqk3p.webp	[{"id":"f0b5ca21-d32e-49b0-ba0b-93cd006b4c83","url":"https://nmd.marketing/api/uploads/1772872685931-uxgkqk3p.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:38:06.713Z	f	f	13
7bc9d269-1e64-4c7f-b738-93e493d62fd1	2f663230-f9b3-463c-b8ab-eb55a5474b95	f5bfd656-d9c1-41e9-af52-41eb9b215cf9	كرمبوليا ابو ايمن 	كرمبوليا ابو ايمن 	\N	SIMPLE	30	ILS	https://nmd.marketing/api/uploads/1772872519497-nfxk47jv.webp	[{"id":"1eaa7b35-84d6-49de-9d7a-f80f9a38b989","url":"https://nmd.marketing/api/uploads/1772872519497-nfxk47jv.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:35:22.953Z	f	f	29
120d2ccb-6395-42c4-8a71-3ecaccc81114	2f663230-f9b3-463c-b8ab-eb55a5474b95	f5bfd656-d9c1-41e9-af52-41eb9b215cf9	كرمبوليا دلال	كرمبوليا دلال	\N	SIMPLE	30	ILS	https://nmd.marketing/api/uploads/1772872549057-lvwxegl6.webp	[{"id":"cac79723-cc52-48b2-a653-3378d0a44557","url":"https://nmd.marketing/api/uploads/1772872549057-lvwxegl6.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:35:50.587Z	f	f	30
095e10aa-3956-412b-b17e-a84d1dba291d	2f663230-f9b3-463c-b8ab-eb55a5474b95	f5bfd656-d9c1-41e9-af52-41eb9b215cf9	سان سبيستيان	سان سبيستيان	\N	SIMPLE	30	ILS	https://nmd.marketing/api/uploads/1772872577329-c7tedkci.webp	[{"id":"86bbbdf4-c024-4637-a34e-ba346815d450","url":"https://nmd.marketing/api/uploads/1772872577329-c7tedkci.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:36:23.777Z	f	f	31
1a265d57-9e80-46fc-a19a-28d633e105d4	2f663230-f9b3-463c-b8ab-eb55a5474b95	f5bfd656-d9c1-41e9-af52-41eb9b215cf9	ابو الزامل	ابو الزامل	\N	SIMPLE	35	ILS	https://nmd.marketing/api/uploads/1772872619842-rg5jvtij.webp	[{"id":"e56cf2b5-6d5e-4013-b65f-b60753ebea3d","url":"https://nmd.marketing/api/uploads/1772872619842-rg5jvtij.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:37:05.257Z	f	f	33
eac59abf-c750-48f8-8d23-58ea505c522b	2f663230-f9b3-463c-b8ab-eb55a5474b95	f5bfd656-d9c1-41e9-af52-41eb9b215cf9	جميرا	جميرا	\N	SIMPLE	30	ILS	https://nmd.marketing/api/uploads/1772872641119-wb72uyt1.webp	[{"id":"b6a51ab6-17d1-42f9-91eb-f9dddfe43500","url":"https://nmd.marketing/api/uploads/1772872641119-wb72uyt1.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:37:25.387Z	f	f	34
a284bc74-7a3a-4a33-93f0-9200b31869ab	2f663230-f9b3-463c-b8ab-eb55a5474b95	f5bfd656-d9c1-41e9-af52-41eb9b215cf9	تيراميسو	تيراميسو	\N	SIMPLE	30	ILS	https://nmd.marketing/api/uploads/1772872667279-xs5e8y8b.webp	[{"id":"14abc41e-e40f-4384-9b27-9f5d803503f9","url":"https://nmd.marketing/api/uploads/1772872667279-xs5e8y8b.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:37:48.983Z	f	f	35
33aa95d8-c5d2-446b-8fb0-37d6fac85394	2f663230-f9b3-463c-b8ab-eb55a5474b95	f5bfd656-d9c1-41e9-af52-41eb9b215cf9	تيريلتشي	تيريلتشي	\N	SIMPLE	25	ILS	https://nmd.marketing/api/uploads/1772872707072-fkcbx7yb.webp	[{"id":"09f1a5f2-a71b-47f9-8a30-985d2c3ad75c","url":"https://nmd.marketing/api/uploads/1772872707072-fkcbx7yb.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:38:28.370Z	f	f	37
b36d6130-2d6f-444f-93fc-0b3c1aa6bf4e	2f663230-f9b3-463c-b8ab-eb55a5474b95	f5bfd656-d9c1-41e9-af52-41eb9b215cf9	دي باريس بوستاشيو	دي باريس بوستاشيو	\N	SIMPLE	50	ILS	https://nmd.marketing/api/uploads/1772872760411-iam35nve.webp	[{"id":"29770f5d-858e-48bb-9dfc-566a9b6a21bb","url":"https://nmd.marketing/api/uploads/1772872760411-iam35nve.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:39:21.563Z	f	f	38
0c1cf9e5-10f2-417d-80dc-b44e888bb941	2f663230-f9b3-463c-b8ab-eb55a5474b95	f5bfd656-d9c1-41e9-af52-41eb9b215cf9	دي باريس باتسيير	دي باريس باتسيير	\N	SIMPLE	50	ILS	https://nmd.marketing/api/uploads/1772872796726-c5j2hu9g.webp	[{"id":"5b5d8c0d-8b3a-405a-b513-4b6ec8aef400","url":"https://nmd.marketing/api/uploads/1772872796726-c5j2hu9g.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:40:01.164Z	f	f	39
8148207a-d6a6-4bd0-97c9-58f1ff422063	2f663230-f9b3-463c-b8ab-eb55a5474b95	0add86a7-97bb-4495-a3e3-e3d22794b4b0	مقدوحة شوكلاطة	مقدوحة شوكلاطة	\N	SIMPLE	8	ILS	https://nmd.marketing/api/uploads/1772872850480-i08jlscb.webp	[{"id":"f013b832-68f0-4c58-8a66-c70778d04aac","url":"https://nmd.marketing/api/uploads/1772872850480-i08jlscb.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:40:51.790Z	f	f	41
1150167c-1289-4202-ae1e-9cd37969d02c	2f663230-f9b3-463c-b8ab-eb55a5474b95	0add86a7-97bb-4495-a3e3-e3d22794b4b0	ذرة صغير	ذرة صغير	\N	SIMPLE	10	ILS	https://nmd.marketing/api/uploads/1772872874172-ldzotlfc.webp	[{"id":"d46ec843-5145-4954-bfbb-2b2814fba1d4","url":"https://nmd.marketing/api/uploads/1772872874172-ldzotlfc.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:41:14.758Z	f	f	42
4b035304-f8c6-4209-a85d-18fee16c3858	2f663230-f9b3-463c-b8ab-eb55a5474b95	0add86a7-97bb-4495-a3e3-e3d22794b4b0	ذرة صغير + جبنة	ذرة صغير + جبنة	\N	SIMPLE	15	ILS	https://nmd.marketing/api/uploads/1772872896822-wb5n7u26.webp	[{"id":"79c2555b-c926-4200-beea-feb3d25bdeca","url":"https://nmd.marketing/api/uploads/1772872896822-wb5n7u26.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:41:37.964Z	f	f	43
0c83138b-106d-4d7c-a820-2de56693c00a	2f663230-f9b3-463c-b8ab-eb55a5474b95	0add86a7-97bb-4495-a3e3-e3d22794b4b0	ذرة كبير	ذرة كبير	\N	SIMPLE	17	ILS	https://nmd.marketing/api/uploads/1772872929951-gt25fvp0.webp	[{"id":"ad823b3a-ba74-4072-b85c-8ec0b0b181ea","url":"https://nmd.marketing/api/uploads/1772872929951-gt25fvp0.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:43:20.119Z	f	f	44
608b467e-efac-4329-bb1c-a0266f8910dc	2f663230-f9b3-463c-b8ab-eb55a5474b95	0add86a7-97bb-4495-a3e3-e3d22794b4b0	ذرة كبير + جبنة	ذرة كبير + جبنة	\N	SIMPLE	25	ILS	https://nmd.marketing/api/uploads/1772873033541-bkvnwxkb.webp	[{"id":"d6b66160-fb95-4ea5-bd57-52eb26e94584","url":"https://nmd.marketing/api/uploads/1772873033541-bkvnwxkb.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:43:53.887Z	f	f	45
d57f6af4-23d9-4b78-84f9-72389248d3be	2f663230-f9b3-463c-b8ab-eb55a5474b95	0add86a7-97bb-4495-a3e3-e3d22794b4b0	كومبير	كومبير	\N	SIMPLE	30	ILS	https://nmd.marketing/api/uploads/1772873070751-h95vg2i4.webp	[{"id":"340a783c-a217-4529-b3e4-10a549a118c7","url":"https://nmd.marketing/api/uploads/1772873070751-h95vg2i4.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:44:34.483Z	f	f	46
3c7192e3-250a-4572-8dec-fd5d1a2eddf3	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	عصير تفاح صغير	عصير تفاح صغير	\N	SIMPLE	10	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:07:49.835Z	f	f	30
1b9b3444-d3a0-457b-b73b-f7965831b602	2f663230-f9b3-463c-b8ab-eb55a5474b95	f5bfd656-d9c1-41e9-af52-41eb9b215cf9	فرفوشكا فرح	فرفوشكا فرح	\N	SIMPLE	35	ILS	https://nmd.marketing/api/uploads/1772872491960-be9qyiue.webp	[{"id":"d03fa428-a7b2-40aa-b6a7-58f02d5d5888","url":"https://nmd.marketing/api/uploads/1772872491960-be9qyiue.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:34:52.203Z	f	f	28
003ba2ca-5ecc-4e38-a3e0-015d7ed0679c	2f663230-f9b3-463c-b8ab-eb55a5474b95	81bc78b8-de83-41f8-b6fd-fecb9392deb3	بانكيك	بانكيك	\N	SIMPLE	50	ILS	https://nmd.marketing/api/uploads/1772873349088-bnddtso2.webp	[{"id":"74b6542b-61d7-441d-a3f2-879bcca8e704","url":"https://nmd.marketing/api/uploads/1772873349088-bnddtso2.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:49:16.120Z	f	f	49
f031b82c-23fb-4685-a5f1-1d04bb4731bf	2f663230-f9b3-463c-b8ab-eb55a5474b95	771dc16e-86b4-471b-91c4-61b4c754fafa	جروس ليمون اناناس	جروس ليمون اناناس	\N	SIMPLE	25	ILS	https://nmd.marketing/api/uploads/1772874209741-mwn0n21x.webp	[{"id":"68a73aa9-a644-40dd-bec9-ca2c7f1e4e60","url":"https://nmd.marketing/api/uploads/1772874209741-mwn0n21x.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T09:03:30.083Z	f	f	55
7d3d8a8b-19d5-42e4-9b89-a28de4de54ba	2f663230-f9b3-463c-b8ab-eb55a5474b95	771dc16e-86b4-471b-91c4-61b4c754fafa	شيك فواكه	شيك فواكه	\N	SIMPLE	0	ILS	https://nmd.marketing/api/uploads/1772874236603-tg3uj9v9.webp	[{"id":"dcae61ce-291e-4a37-8046-f8949b4a6fb3","url":"https://nmd.marketing/api/uploads/1772874236603-tg3uj9v9.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T09:03:57.567Z	f	f	56
538e2d51-dc6f-49ae-a706-3f5a4ad8f657	2f663230-f9b3-463c-b8ab-eb55a5474b95	47c7658d-7663-426c-97cd-0436e757c754	لمة الحبايب	لمة الحبايب	\N	SIMPLE	109	ILS	https://nmd.marketing/api/uploads/1772874303248-plonlv25.webp	[{"id":"fe4fdfe2-a522-40d5-9858-78c531e04ddf","url":"https://nmd.marketing/api/uploads/1772874303248-plonlv25.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T09:05:03.688Z	f	f	57
4c290124-2b2d-4610-a940-299f99184c5e	2f663230-f9b3-463c-b8ab-eb55a5474b95	47c7658d-7663-426c-97cd-0436e757c754	ايس كافيه	ايس كافيه	\N	SIMPLE	15	ILS	https://nmd.marketing/api/uploads/1772874326425-myvkmfbs.webp	[{"id":"e1fbfb6a-c16f-4868-a57e-8600443b986a","url":"https://nmd.marketing/api/uploads/1772874326425-myvkmfbs.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T09:05:28.006Z	f	f	58
e8d63214-bd7e-4ba5-b4d2-304337a12190	2f663230-f9b3-463c-b8ab-eb55a5474b95	47c7658d-7663-426c-97cd-0436e757c754	ايس فانيل	ايس فانيل	\N	SIMPLE	15	ILS	https://nmd.marketing/api/uploads/1772874346460-pa0a449x.webp	[{"id":"dbffde4c-5a6d-4c76-b447-b0e98a5c1cad","url":"https://nmd.marketing/api/uploads/1772874346460-pa0a449x.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T09:05:46.735Z	f	f	59
24cfc2a4-1cc6-4c68-bb3d-4a0b750a7ade	2f663230-f9b3-463c-b8ab-eb55a5474b95	81bc78b8-de83-41f8-b6fd-fecb9392deb3	فشافيش	فشافيش	\N	SIMPLE	30	ILS	https://nmd.marketing/api/uploads/1772873330708-v24v8u3n.webp	[{"id":"28d349b6-f556-46c5-9cb9-31a48c610f93","url":"https://nmd.marketing/api/uploads/1772873330708-v24v8u3n.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:48:51.350Z	f	f	48
e8ec2147-2eea-482f-8aa9-25d2d8f8ced7	2f663230-f9b3-463c-b8ab-eb55a5474b95	81bc78b8-de83-41f8-b6fd-fecb9392deb3	بافل بلجي	بافل بلجي	\N	SIMPLE	30	ILS	https://nmd.marketing/api/uploads/1772873384162-ue5dtejz.webp	[{"id":"da16d8b0-10df-43c4-b9b8-3c2055fe5d72","url":"https://nmd.marketing/api/uploads/1772873384162-ue5dtejz.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:49:44.679Z	f	f	50
38c42702-0110-47dd-86ad-41f2615feeb5	2f663230-f9b3-463c-b8ab-eb55a5474b95	771dc16e-86b4-471b-91c4-61b4c754fafa	عصير برتقال طبيعي	عصير برتقال طبيعي	\N	SIMPLE	20	ILS	https://nmd.marketing/api/uploads/1772874130243-fsvvbb69.webp	[{"id":"667fe886-0f06-4260-9f9b-2c9cc41a52f5","url":"https://nmd.marketing/api/uploads/1772874130243-fsvvbb69.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T09:02:15.440Z	f	f	52
4665f81b-e99d-4dab-b10b-cefe1bd27c4c	2f663230-f9b3-463c-b8ab-eb55a5474b95	771dc16e-86b4-471b-91c4-61b4c754fafa	جروس ليمون نعنع	جروس ليمون نعنع	\N	SIMPLE	20	ILS	https://nmd.marketing/api/uploads/1772874184502-t7hz6r8n.webp	[{"id":"1f813def-5371-49c6-9d7a-27007698de2e","url":"https://nmd.marketing/api/uploads/1772874184502-t7hz6r8n.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T09:03:04.917Z	f	f	54
7f53078d-3ed7-44d3-8ea0-bef86b940f23	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	اسياخ الوافل	اسياخ الوافل	5 اسياخ وافل مع الشوكلاتة واضافات من اختيارك	SIMPLE	30	ILS	\N	[]	[{"id":"c358d252-8b92-4f5e-b02f-6d422c06b09f","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"شكولاتة","required":true,"minSelected":1,"maxSelected":1,"selectionType":"single","items":[{"id":"1a308d46-2983-402d-bf65-9407802bf176","groupId":"c358d252-8b92-4f5e-b02f-6d422c06b09f","name":"شوكلاطة بيضاء","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"eefaa9ca-183f-45c8-b528-0875b2c751ea","groupId":"c358d252-8b92-4f5e-b02f-6d422c06b09f","name":"شوكلاتة بنية","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false}]},{"id":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"اضافات","required":true,"minSelected":0,"maxSelected":3,"selectionType":"multi","items":[{"id":"2fc3955d-7eea-4fbe-bc2b-eaa5ee76850f","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"اوريو مطحون","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"b0bee7b5-f1fb-4fa0-84a9-f98a17d14836","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"لوتس مطحون","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false},{"id":"8437edb4-f4ac-486b-8e44-15e74b87f1b5","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"كليك بني","priceDelta":0,"sortOrder":2,"enabled":true,"defaultSelected":false},{"id":"1d8b4b74-6d06-4b27-8879-991443883694","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"كليك ابيض","priceDelta":0,"sortOrder":3,"enabled":true,"defaultSelected":false},{"id":"90735705-99fc-4c47-b08f-5095a6dbab7d","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"مكوبيلت بني","priceDelta":0,"sortOrder":4,"enabled":true,"defaultSelected":false},{"id":"253d8d6e-1276-45d8-b857-7b010dbfa4e9","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"مكوبيلت ابيض","priceDelta":0,"sortOrder":5,"enabled":true,"defaultSelected":false},{"id":"a250c44e-d977-46d9-b0a1-a46e2502618a","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"الدببة الصمغية","priceDelta":0,"sortOrder":6,"enabled":true,"defaultSelected":false},{"id":"5bd9fc6f-1fe5-49c4-87c7-304bc5f33b64","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"ملبس ملون","priceDelta":0,"sortOrder":7,"enabled":true,"defaultSelected":false},{"id":"c017f244-73fc-4df2-a147-c4724f30302e","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"الفول سوداني بوتنيم","priceDelta":0,"sortOrder":8,"enabled":true,"defaultSelected":false}]}]	[{"id":"58341e28-9b65-4f49-8840-35ff15373b28","optionValues":[{"groupId":"5d1be77b-0774-4a15-bd69-d98ed8858cc0","optionId":"438e1b91-9eff-432a-8f00-bcdd53e1cd11"},{"groupId":"04bbf8b6-f685-4e1a-a20c-01c7d9703ca9","optionId":"08aae2e8-4e07-42df-a1b4-3ada45415a7c"}],"stock":100000},{"id":"1f6ef707-5615-4533-b0fd-f5015a52bb7b","optionValues":[{"groupId":"5d1be77b-0774-4a15-bd69-d98ed8858cc0","optionId":"438e1b91-9eff-432a-8f00-bcdd53e1cd11"},{"groupId":"04bbf8b6-f685-4e1a-a20c-01c7d9703ca9","optionId":"c18188a3-7279-400a-897f-12943aa4b42f"}],"stock":100000},{"id":"c04b901b-a5d3-4308-8bb9-32286bf4838e","optionValues":[{"groupId":"5d1be77b-0774-4a15-bd69-d98ed8858cc0","optionId":"438e1b91-9eff-432a-8f00-bcdd53e1cd11"},{"groupId":"04bbf8b6-f685-4e1a-a20c-01c7d9703ca9","optionId":"be3bd147-ecf4-4050-9497-ef0f31a1df09"}],"stock":100000},{"id":"49975dce-90a4-471b-9c9a-817cd4c456c6","optionValues":[{"groupId":"5d1be77b-0774-4a15-bd69-d98ed8858cc0","optionId":"438e1b91-9eff-432a-8f00-bcdd53e1cd11"},{"groupId":"04bbf8b6-f685-4e1a-a20c-01c7d9703ca9","optionId":"7a1dc371-41af-442a-8795-a5c1b2e3997d"}],"stock":99999},{"id":"7555d337-0fb7-4f8a-b58f-92c7c4ac063f","optionValues":[{"groupId":"5d1be77b-0774-4a15-bd69-d98ed8858cc0","optionId":"438e1b91-9eff-432a-8f00-bcdd53e1cd11"},{"groupId":"04bbf8b6-f685-4e1a-a20c-01c7d9703ca9","optionId":"ebe8a5a4-38f6-4cd7-881e-1e4f2b1fcfc3"}],"stock":100000},{"id":"c7cb0f9d-c5d7-4c0c-9c16-01e6858cec81","optionValues":[{"groupId":"5d1be77b-0774-4a15-bd69-d98ed8858cc0","optionId":"438e1b91-9eff-432a-8f00-bcdd53e1cd11"},{"groupId":"04bbf8b6-f685-4e1a-a20c-01c7d9703ca9","optionId":"c0292ada-7c5b-4937-b06e-420997a72729"}],"stock":100000},{"id":"5ccdbce6-b44a-4e6f-abab-94917d4efb56","optionValues":[{"groupId":"5d1be77b-0774-4a15-bd69-d98ed8858cc0","optionId":"438e1b91-9eff-432a-8f00-bcdd53e1cd11"},{"groupId":"04bbf8b6-f685-4e1a-a20c-01c7d9703ca9","optionId":"3324a93a-8e37-472a-bcb4-cbadc29c3a72"}],"stock":99999},{"id":"e7056fd9-99bf-4376-8269-72103faddf38","optionValues":[{"groupId":"5d1be77b-0774-4a15-bd69-d98ed8858cc0","optionId":"438e1b91-9eff-432a-8f00-bcdd53e1cd11"},{"groupId":"04bbf8b6-f685-4e1a-a20c-01c7d9703ca9","optionId":"75c75c42-1d8a-44f3-a7a4-de0112676e2f"}],"stock":100000},{"id":"f6a192fc-b65c-4a93-b5a0-129ee9855ba8","optionValues":[{"groupId":"5d1be77b-0774-4a15-bd69-d98ed8858cc0","optionId":"438e1b91-9eff-432a-8f00-bcdd53e1cd11"},{"groupId":"04bbf8b6-f685-4e1a-a20c-01c7d9703ca9","optionId":"54873fa2-14d0-482c-b50b-bde421b7f6d1"}],"stock":100000},{"id":"49d843e4-30ef-4a19-b155-5de06154de84","optionValues":[{"groupId":"5d1be77b-0774-4a15-bd69-d98ed8858cc0","optionId":"cb9c0c14-1049-45ae-9fc6-166136725b3a"},{"groupId":"04bbf8b6-f685-4e1a-a20c-01c7d9703ca9","optionId":"08aae2e8-4e07-42df-a1b4-3ada45415a7c"}],"stock":1000000},{"id":"c555c5e2-c20d-4819-8e5f-adb2ba0acd8a","optionValues":[{"groupId":"5d1be77b-0774-4a15-bd69-d98ed8858cc0","optionId":"cb9c0c14-1049-45ae-9fc6-166136725b3a"},{"groupId":"04bbf8b6-f685-4e1a-a20c-01c7d9703ca9","optionId":"c18188a3-7279-400a-897f-12943aa4b42f"}],"stock":100000},{"id":"dff09ec7-fc09-4d8b-932f-161663d32b41","optionValues":[{"groupId":"5d1be77b-0774-4a15-bd69-d98ed8858cc0","optionId":"cb9c0c14-1049-45ae-9fc6-166136725b3a"},{"groupId":"04bbf8b6-f685-4e1a-a20c-01c7d9703ca9","optionId":"be3bd147-ecf4-4050-9497-ef0f31a1df09"}],"stock":100000},{"id":"e9eed5ba-2d83-4553-97be-c2fee7282c40","optionValues":[{"groupId":"5d1be77b-0774-4a15-bd69-d98ed8858cc0","optionId":"cb9c0c14-1049-45ae-9fc6-166136725b3a"},{"groupId":"04bbf8b6-f685-4e1a-a20c-01c7d9703ca9","optionId":"7a1dc371-41af-442a-8795-a5c1b2e3997d"}],"stock":1000000},{"id":"b84143c8-efaa-46d3-b41f-e7d0730bc4ed","optionValues":[{"groupId":"5d1be77b-0774-4a15-bd69-d98ed8858cc0","optionId":"cb9c0c14-1049-45ae-9fc6-166136725b3a"},{"groupId":"04bbf8b6-f685-4e1a-a20c-01c7d9703ca9","optionId":"ebe8a5a4-38f6-4cd7-881e-1e4f2b1fcfc3"}],"stock":100000},{"id":"edf79943-6df8-475c-ae4a-6ba756376bac","optionValues":[{"groupId":"5d1be77b-0774-4a15-bd69-d98ed8858cc0","optionId":"cb9c0c14-1049-45ae-9fc6-166136725b3a"},{"groupId":"04bbf8b6-f685-4e1a-a20c-01c7d9703ca9","optionId":"c0292ada-7c5b-4937-b06e-420997a72729"}],"stock":100000},{"id":"3ea67ef6-cb91-4edf-9c1f-c33df2bb70c2","optionValues":[{"groupId":"5d1be77b-0774-4a15-bd69-d98ed8858cc0","optionId":"cb9c0c14-1049-45ae-9fc6-166136725b3a"},{"groupId":"04bbf8b6-f685-4e1a-a20c-01c7d9703ca9","optionId":"3324a93a-8e37-472a-bcb4-cbadc29c3a72"}],"stock":100000},{"id":"d8e6b6b0-9ae3-44e7-8f80-3c00d751d59a","optionValues":[{"groupId":"5d1be77b-0774-4a15-bd69-d98ed8858cc0","optionId":"cb9c0c14-1049-45ae-9fc6-166136725b3a"},{"groupId":"04bbf8b6-f685-4e1a-a20c-01c7d9703ca9","optionId":"75c75c42-1d8a-44f3-a7a4-de0112676e2f"}],"stock":100000},{"id":"d8497c44-0951-4ffe-a765-0bdc211aa1e8","optionValues":[{"groupId":"5d1be77b-0774-4a15-bd69-d98ed8858cc0","optionId":"cb9c0c14-1049-45ae-9fc6-166136725b3a"},{"groupId":"04bbf8b6-f685-4e1a-a20c-01c7d9703ca9","optionId":"54873fa2-14d0-482c-b50b-bde421b7f6d1"}],"stock":100000}]	\N	t	2026-03-09T18:40:40.552Z	f	f	5
2ec42e74-5c07-4b92-9d73-33c957a6814c	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	فشافيش	فشافيش	كرات الفطائر الهولندية مع الشزكلاتة 16 قطعة	SIMPLE	30	ILS	\N	[]	[{"id":"c358d252-8b92-4f5e-b02f-6d422c06b09f","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"شكولاتة","required":true,"minSelected":1,"maxSelected":1,"selectionType":"single","items":[{"id":"1a308d46-2983-402d-bf65-9407802bf176","groupId":"c358d252-8b92-4f5e-b02f-6d422c06b09f","name":"شوكلاطة بيضاء","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"eefaa9ca-183f-45c8-b528-0875b2c751ea","groupId":"c358d252-8b92-4f5e-b02f-6d422c06b09f","name":"شوكلاتة بنية","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false}]},{"id":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"اضافات","required":true,"minSelected":0,"maxSelected":3,"selectionType":"multi","items":[{"id":"2fc3955d-7eea-4fbe-bc2b-eaa5ee76850f","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"اوريو مطحون","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"b0bee7b5-f1fb-4fa0-84a9-f98a17d14836","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"لوتس مطحون","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false},{"id":"8437edb4-f4ac-486b-8e44-15e74b87f1b5","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"كليك بني","priceDelta":0,"sortOrder":2,"enabled":true,"defaultSelected":false},{"id":"1d8b4b74-6d06-4b27-8879-991443883694","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"كليك ابيض","priceDelta":0,"sortOrder":3,"enabled":true,"defaultSelected":false},{"id":"90735705-99fc-4c47-b08f-5095a6dbab7d","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"مكوبيلت بني","priceDelta":0,"sortOrder":4,"enabled":true,"defaultSelected":false},{"id":"253d8d6e-1276-45d8-b857-7b010dbfa4e9","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"مكوبيلت ابيض","priceDelta":0,"sortOrder":5,"enabled":true,"defaultSelected":false},{"id":"a250c44e-d977-46d9-b0a1-a46e2502618a","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"الدببة الصمغية","priceDelta":0,"sortOrder":6,"enabled":true,"defaultSelected":false},{"id":"5bd9fc6f-1fe5-49c4-87c7-304bc5f33b64","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"ملبس ملون","priceDelta":0,"sortOrder":7,"enabled":true,"defaultSelected":false},{"id":"c017f244-73fc-4df2-a147-c4724f30302e","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"الفول سوداني بوتنيم","priceDelta":0,"sortOrder":8,"enabled":true,"defaultSelected":false}]}]	[]	\N	t	2026-03-09T19:24:41.381Z	f	f	6
8c454ef5-fe59-46dd-8b63-8708239728a7	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	هبورجر بانكيك	هبورجر بانكيك	\N	SIMPLE	30	ILS	\N	[]	[{"id":"c358d252-8b92-4f5e-b02f-6d422c06b09f","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"شكولاتة","required":true,"minSelected":1,"maxSelected":1,"selectionType":"single","items":[{"id":"1a308d46-2983-402d-bf65-9407802bf176","groupId":"c358d252-8b92-4f5e-b02f-6d422c06b09f","name":"شوكلاطة بيضاء","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"eefaa9ca-183f-45c8-b528-0875b2c751ea","groupId":"c358d252-8b92-4f5e-b02f-6d422c06b09f","name":"شوكلاتة بنية","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false}]},{"id":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"اضافات","required":true,"minSelected":0,"maxSelected":3,"selectionType":"multi","items":[{"id":"2fc3955d-7eea-4fbe-bc2b-eaa5ee76850f","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"اوريو مطحون","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"b0bee7b5-f1fb-4fa0-84a9-f98a17d14836","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"لوتس مطحون","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false},{"id":"8437edb4-f4ac-486b-8e44-15e74b87f1b5","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"كليك بني","priceDelta":0,"sortOrder":2,"enabled":true,"defaultSelected":false},{"id":"1d8b4b74-6d06-4b27-8879-991443883694","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"كليك ابيض","priceDelta":0,"sortOrder":3,"enabled":true,"defaultSelected":false},{"id":"90735705-99fc-4c47-b08f-5095a6dbab7d","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"مكوبيلت بني","priceDelta":0,"sortOrder":4,"enabled":true,"defaultSelected":false},{"id":"253d8d6e-1276-45d8-b857-7b010dbfa4e9","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"مكوبيلت ابيض","priceDelta":0,"sortOrder":5,"enabled":true,"defaultSelected":false},{"id":"a250c44e-d977-46d9-b0a1-a46e2502618a","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"الدببة الصمغية","priceDelta":0,"sortOrder":6,"enabled":true,"defaultSelected":false},{"id":"5bd9fc6f-1fe5-49c4-87c7-304bc5f33b64","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"ملبس ملون","priceDelta":0,"sortOrder":7,"enabled":true,"defaultSelected":false},{"id":"c017f244-73fc-4df2-a147-c4724f30302e","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"الفول سوداني بوتنيم","priceDelta":0,"sortOrder":8,"enabled":true,"defaultSelected":false}]}]	[]	\N	t	2026-03-09T19:26:04.646Z	f	f	7
a4a63357-0d18-4a2d-9ead-8f885de19aaf	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	ميني بانكيك	ميني بانكيك	\N	SIMPLE	25	ILS	\N	[]	[{"id":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"اضافات","required":true,"minSelected":0,"maxSelected":3,"selectionType":"multi","items":[{"id":"2fc3955d-7eea-4fbe-bc2b-eaa5ee76850f","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"اوريو مطحون","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"b0bee7b5-f1fb-4fa0-84a9-f98a17d14836","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"لوتس مطحون","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false},{"id":"8437edb4-f4ac-486b-8e44-15e74b87f1b5","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"كليك بني","priceDelta":0,"sortOrder":2,"enabled":true,"defaultSelected":false},{"id":"1d8b4b74-6d06-4b27-8879-991443883694","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"كليك ابيض","priceDelta":0,"sortOrder":3,"enabled":true,"defaultSelected":false},{"id":"90735705-99fc-4c47-b08f-5095a6dbab7d","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"مكوبيلت بني","priceDelta":0,"sortOrder":4,"enabled":true,"defaultSelected":false},{"id":"253d8d6e-1276-45d8-b857-7b010dbfa4e9","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"مكوبيلت ابيض","priceDelta":0,"sortOrder":5,"enabled":true,"defaultSelected":false},{"id":"a250c44e-d977-46d9-b0a1-a46e2502618a","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"الدببة الصمغية","priceDelta":0,"sortOrder":6,"enabled":true,"defaultSelected":false},{"id":"5bd9fc6f-1fe5-49c4-87c7-304bc5f33b64","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"ملبس ملون","priceDelta":0,"sortOrder":7,"enabled":true,"defaultSelected":false},{"id":"c017f244-73fc-4df2-a147-c4724f30302e","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"الفول سوداني بوتنيم","priceDelta":0,"sortOrder":8,"enabled":true,"defaultSelected":false}]},{"id":"c358d252-8b92-4f5e-b02f-6d422c06b09f","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"شكولاتة","required":true,"minSelected":1,"maxSelected":1,"selectionType":"single","items":[{"id":"1a308d46-2983-402d-bf65-9407802bf176","groupId":"c358d252-8b92-4f5e-b02f-6d422c06b09f","name":"شوكلاطة بيضاء","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"eefaa9ca-183f-45c8-b528-0875b2c751ea","groupId":"c358d252-8b92-4f5e-b02f-6d422c06b09f","name":"شوكلاتة بنية","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false}]}]	[]	\N	t	2026-03-09T19:26:37.168Z	f	f	8
12c7aa21-145d-47a6-a3a5-7b5a6cbf9551	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	كريب الشوكلاطة	كريب الشوكلاطة	\N	SIMPLE	30	ILS	\N	[]	[{"id":"c358d252-8b92-4f5e-b02f-6d422c06b09f","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"شكولاتة","required":true,"minSelected":1,"maxSelected":1,"selectionType":"single","items":[{"id":"1a308d46-2983-402d-bf65-9407802bf176","groupId":"c358d252-8b92-4f5e-b02f-6d422c06b09f","name":"شوكلاطة بيضاء","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"eefaa9ca-183f-45c8-b528-0875b2c751ea","groupId":"c358d252-8b92-4f5e-b02f-6d422c06b09f","name":"شوكلاتة بنية","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false}]},{"id":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"اضافات","required":true,"minSelected":0,"maxSelected":3,"selectionType":"multi","items":[{"id":"2fc3955d-7eea-4fbe-bc2b-eaa5ee76850f","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"اوريو مطحون","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"b0bee7b5-f1fb-4fa0-84a9-f98a17d14836","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"لوتس مطحون","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false},{"id":"8437edb4-f4ac-486b-8e44-15e74b87f1b5","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"كليك بني","priceDelta":0,"sortOrder":2,"enabled":true,"defaultSelected":false},{"id":"1d8b4b74-6d06-4b27-8879-991443883694","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"كليك ابيض","priceDelta":0,"sortOrder":3,"enabled":true,"defaultSelected":false},{"id":"90735705-99fc-4c47-b08f-5095a6dbab7d","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"مكوبيلت بني","priceDelta":0,"sortOrder":4,"enabled":true,"defaultSelected":false},{"id":"253d8d6e-1276-45d8-b857-7b010dbfa4e9","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"مكوبيلت ابيض","priceDelta":0,"sortOrder":5,"enabled":true,"defaultSelected":false},{"id":"a250c44e-d977-46d9-b0a1-a46e2502618a","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"الدببة الصمغية","priceDelta":0,"sortOrder":6,"enabled":true,"defaultSelected":false},{"id":"5bd9fc6f-1fe5-49c4-87c7-304bc5f33b64","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"ملبس ملون","priceDelta":0,"sortOrder":7,"enabled":true,"defaultSelected":false},{"id":"c017f244-73fc-4df2-a147-c4724f30302e","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"الفول سوداني بوتنيم","priceDelta":0,"sortOrder":8,"enabled":true,"defaultSelected":false}]}]	[]	\N	t	2026-03-09T18:36:18.859Z	f	f	4
418d20e6-27e4-47cb-b9f5-55135b7157bc	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	94b0e9c6-fbc0-4023-a823-4941b142650d	سوفليه	سوفليه	\N	SIMPLE	30	ILS	\N	[]	[]	[]	\N	t	2026-03-09T19:28:49.278Z	f	f	11
521e6508-d47f-4ca5-b651-a440a2dec576	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	64dff88f-0664-4489-a7b7-5d2e5aac9690	ميلك شيك كيندر صغير	ميلك شيك كيندر صغير	\N	SIMPLE	15	ILS	\N	[]	[]	[]	\N	t	2026-03-09T19:34:04.829Z	f	f	18
8a9b36c1-b904-49d4-9a23-3e8104422f61	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	64dff88f-0664-4489-a7b7-5d2e5aac9690	ميلك شيك كندر كبير	ميلك شيك كندر كبير	\N	SIMPLE	20	ILS	\N	[]	[]	[]	\N	t	2026-03-09T19:34:34.381Z	f	f	19
34b9bde0-e191-498b-9e5d-4f77be2430be	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	64dff88f-0664-4489-a7b7-5d2e5aac9690	ميلك شيك فيريرو روشيه صغير	ميلك شيك فيريرو روشيه صغير	\N	SIMPLE	15	ILS	\N	[]	[]	[]	\N	t	2026-03-09T19:35:20.762Z	f	f	20
d34476d0-801b-4a2d-9114-f422a07658de	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	ميلك شيك فيريرو روشيه كبير	ميلك شيك فيريرو روشيه كبير	\N	SIMPLE	19	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:04:26.390Z	f	f	21
a9e91edd-c71f-4dea-9a74-e427ead94bfb	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	ميلك شيك علكة صغير	ميلك شيك علكة صغير	\N	SIMPLE	15	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:04:43.797Z	f	f	22
76c8d63d-5352-49f1-b20c-a8ca5f5f22ad	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	ميلك شيك علكة كبير	ميلك شيك علكة كبير	\N	SIMPLE	20	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:04:58.681Z	f	f	23
71467285-a65a-43b1-94c5-150ab66d42f5	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	ميلك شيك مارشميلو صغير	ميلك شيك مارشميلو صغير	\N	SIMPLE	15	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:05:30.213Z	f	f	24
1feb04d5-aa83-4b9d-8299-61d57caeee1d	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	ميلك شيك مارشميلو كبير	ميلك شيك مارشميلو كبير	\N	SIMPLE	20	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:05:47.299Z	f	f	25
8d65ebaf-18a0-4ee0-97fe-0160a134c02c	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	441516b1-b539-4a48-a490-4596fcdac409	عصير جزر صغير	عصير جزر صغير	\N	SIMPLE	10	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:06:24.003Z	f	f	26
00c653da-affb-4425-a337-aa4e315760e4	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	عصير جزر كبير 	عصير جزر كبير	\N	SIMPLE	15	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:06:59.763Z	f	f	27
7f2f91c5-0d53-4295-a33e-bb219db4b4ba	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	عصير برتفال صغير	عصير برتفال صغير	\N	SIMPLE	10	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:07:15.821Z	f	f	28
e9d331e2-36bd-42af-92e4-705596ead435	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	عصير برتفال كبير	عصير برتفال كبير	\N	SIMPLE	15	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:07:30.057Z	f	f	29
30d46ffe-a2f5-47f2-ad4b-81af7cf814b6	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	94b0e9c6-fbc0-4023-a823-4941b142650d	سان سيباستيان	سان سيباستيان	\N	SIMPLE	25	ILS	\N	[]	[]	[]	\N	t	2026-03-09T19:29:27.244Z	f	f	12
ef84d5db-a5a0-4c7e-9ae3-f22fce874a80	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	ريد فيلفيت	ريد فيلفيت	\N	SIMPLE	25	ILS	\N	[]	[]	[]	\N	t	2026-03-09T19:29:46.494Z	f	f	13
b4803530-e1e2-4350-a249-3315f33799fa	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	64dff88f-0664-4489-a7b7-5d2e5aac9690	ميلك شيك اللوتس الصغير	ميلك شيك اللوتس الصغير	\N	SIMPLE	15	ILS	\N	[]	[]	[]	\N	t	2026-03-09T19:31:50.413Z	f	f	14
351f1d6a-efdd-4fd9-9c2f-8c06ed7a2a99	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	64dff88f-0664-4489-a7b7-5d2e5aac9690	ميلك شيك اللوتس الكبير	ميلك شيك اللوتس الكبير	\N	SIMPLE	20	ILS	\N	[]	[]	[]	\N	t	2026-03-09T19:32:10.771Z	f	f	15
9b702a13-9c33-49d5-9dc5-d98196b2c509	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	64dff88f-0664-4489-a7b7-5d2e5aac9690	ميلك شيك اوريو صغير	ميلك شيك اوريو صغير	\N	SIMPLE	15	ILS	\N	[]	[]	[]	\N	t	2026-03-09T19:32:58.573Z	f	f	16
45fca0fe-b709-4f54-88f0-c7524c088ef4	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	64dff88f-0664-4489-a7b7-5d2e5aac9690	ميلك شيك اوريو كبير	ميلك شيك اوريو كبير	\N	SIMPLE	20	ILS	\N	[]	[]	[]	\N	t	2026-03-09T19:33:38.571Z	f	f	17
fb579654-655a-4bbd-a5c5-3a2d5d3bf2a1	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	4a153659-44de-4068-9405-fa73a3c53f49	كرة بوظة	كرة بوظة	\N	SIMPLE	8	ILS	\N	[]	[{"id":"d029d825-038b-40b5-af65-c981f8ba40ba","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"بوظة","required":false,"minSelected":1,"maxSelected":6,"selectionType":"multi","items":[{"id":"1f7d1706-bcd9-4f2e-b8b2-71cefab57a2d","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"اوريو","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"1050b1b6-af2b-4893-ac62-282d0e97611f","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"لوتوس","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false},{"id":"b8e43810-6ddb-41b7-bbb8-5c9ca6182e2e","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"كيندر","priceDelta":0,"sortOrder":2,"enabled":true,"defaultSelected":false},{"id":"f972d0f9-0c51-4d92-9db2-1821c7d7f1ef","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"مكوبيلت","priceDelta":0,"sortOrder":3,"enabled":true,"defaultSelected":false},{"id":"728c7868-da19-498d-9c18-7e7ce6c43a64","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"علكة ","priceDelta":0,"sortOrder":4,"enabled":true,"defaultSelected":false},{"id":"5c9068d3-fcb9-4754-b0c2-3404cdc183f9","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"مارشميلو","priceDelta":0,"sortOrder":5,"enabled":true,"defaultSelected":false},{"id":"abbff3f4-4f24-40e3-b760-6c332cf7da35","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"فيريرو روشيه","priceDelta":0,"sortOrder":6,"enabled":true,"defaultSelected":false},{"id":"21fcb80d-114c-4917-83a6-be25fb2cd4d3","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"فواكه بريه (بيروت ياعر )","priceDelta":0,"sortOrder":7,"enabled":true,"defaultSelected":false},{"id":"fbafe2e9-8d3e-452d-a488-319da669715c","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"بسفلورا","priceDelta":0,"sortOrder":8,"enabled":true,"defaultSelected":false},{"id":"b61585e5-ec5a-4036-b07a-7eb10ad8bcc5","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"كراميل ريبات حلاف","priceDelta":0,"sortOrder":9,"enabled":true,"defaultSelected":false},{"id":"81abe5cb-6ae5-4083-a16f-4ed6a7c0d82d","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"كليك","priceDelta":0,"sortOrder":11,"enabled":true,"defaultSelected":false},{"id":"1b293a4e-f8fc-474b-a3b8-aeccb017de7c","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"شوكلاتة دبي","priceDelta":0,"sortOrder":12,"enabled":true,"defaultSelected":false},{"id":"c39d64b1-4d75-49e9-8079-56e3bec3863e","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"توت شمينت","priceDelta":0,"sortOrder":12,"enabled":true,"defaultSelected":false},{"id":"63914c55-73fd-4fd7-b726-4978ad30f666","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"كرز","priceDelta":0,"sortOrder":13,"enabled":true,"defaultSelected":false}]}]	[]	\N	t	2026-03-10T10:14:25.861Z	f	f	37
39185687-79d5-4c75-8d28-7cd502213ca7	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	4a153659-44de-4068-9405-fa73a3c53f49	2 كرات بوظة	2 كرات بوظة	\N	SIMPLE	15	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:14:54.677Z	f	f	38
fbd6cf21-6e67-4cf5-bf00-fd1aece5f616	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	4a153659-44de-4068-9405-fa73a3c53f49	3 كرات بوظة	3 كرات بوظة	\N	SIMPLE	20	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:15:09.831Z	f	f	39
900cd07e-70dd-4573-b5b9-626f8b70d36a	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	d78f85d5-ed7b-4b62-9e8a-6069641e8c1a	موخيتو بلو بيري كبير	موخيتو بلو بيري كبير	\N	SIMPLE	15	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:18:05.372Z	f	f	43
5f2608cb-fb63-4811-a67a-da7402d1e318	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	d78f85d5-ed7b-4b62-9e8a-6069641e8c1a	موخيتو البطيخ الصغير	موخيتو البطيخ الصغير	\N	SIMPLE	10	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:18:29.771Z	f	f	44
b55c7f09-f803-43ce-9f0e-8d8492755499	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	d78f85d5-ed7b-4b62-9e8a-6069641e8c1a	موخيتو البطيخ الكبير	موخيتو البطيخ الكبير	\N	SIMPLE	15	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:18:40.887Z	f	f	45
70f93cfd-81aa-4ac5-9b27-41cfe88f6bb5	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	موخيتو الاناناس الصغير	موخيتو الاناناس الصغير	\N	SIMPLE	10	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:19:01.202Z	f	f	46
f5004d51-d995-48a8-8599-cf6723b247d7	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	موخيتو الاناناس الكبير	موخيتو الاناناس الكبير	\N	SIMPLE	15	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:19:36.808Z	f	f	47
27df869d-95d0-462a-8791-d591af231a6d	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	غصير برتقال جزر كبير	غصير برتقال جزر كبير	\N	SIMPLE	20	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:08:49.875Z	f	f	33
e0dfa17b-7efb-491a-ab84-e68bbca1999f	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	عصير رمان كبير	عصير رمان كبير	\N	SIMPLE	20	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:09:05.560Z	f	f	34
fe139281-94e8-41c3-8bfc-21c55f7345fd	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	d78f85d5-ed7b-4b62-9e8a-6069641e8c1a	موخيتو توت صغير	موخيتو توت صغير	\N	SIMPLE	10	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:16:38.777Z	f	f	40
559d495c-8270-427d-8c5e-2c41700a47c3	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	d78f85d5-ed7b-4b62-9e8a-6069641e8c1a	موخيتو توت كبير	موخيتو توت كبير	\N	SIMPLE	15	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:17:24.856Z	f	f	41
9a7e2c4e-6eaf-4f8b-bea0-f7cb9abc4d38	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	d78f85d5-ed7b-4b62-9e8a-6069641e8c1a	موخيتو بلو بيري صغير	موخيتو بلو بيري صغير	\N	SIMPLE	10	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:17:43.925Z	f	f	42
bd62cb66-a164-48dc-a753-f39cf8b9a877	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	d78f85d5-ed7b-4b62-9e8a-6069641e8c1a	موخيتو مانجو صغير	موخيتو مانجو صغير	\N	SIMPLE	10	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:22:06.977Z	f	f	50
1528963b-26ae-4775-807b-9375832115bc	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	d78f85d5-ed7b-4b62-9e8a-6069641e8c1a	موخيتو مانجو كبير	موخيتو مانجو كبير	\N	SIMPLE	15	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:22:27.767Z	f	f	51
d47dd619-63d1-48b5-9455-7aecd87c2f7a	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2fa37ae7-56e8-4bee-a59f-a5de98e66f55	TMAX موخيتو	TMAX موخيتو	\N	SIMPLE	5	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:30:32.078Z	f	f	52
5434ea92-932c-456e-8547-1ecf132562b4	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2fa37ae7-56e8-4bee-a59f-a5de98e66f55	TMAX بلو بيري	TMAX بلو بيري	\N	SIMPLE	5	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:30:46.406Z	f	f	53
fce64cdb-36fe-4e8d-85ba-374da5d1b60d	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	مشروب التفاح والتوت الازرق الطبيعي	مشروب التفاح والتوت الازرق الطبيعي	\N	SIMPLE	10	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:31:45.762Z	f	f	55
f0ec438a-23d6-431c-bb45-7f6fdf71d3ec	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2fa37ae7-56e8-4bee-a59f-a5de98e66f55	مشروب طبيعي اناناس موز كركم	مشروب طبيعي اناناس موز كركم	\N	SIMPLE	10	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:32:12.533Z	f	f	56
04b3c22c-60ee-4d63-8346-f258afd026ba	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2fa37ae7-56e8-4bee-a59f-a5de98e66f55	مشروب طبيعي مانجو تفاح موز وبسفلورا	مشروب طبيعي مانجو تفاح موز وبسفلورا	\N	SIMPLE	10	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:32:47.123Z	f	f	57
036b4ddd-4cc1-4460-aaaf-146a3919f50d	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2fa37ae7-56e8-4bee-a59f-a5de98e66f55	مشروب طبيعي برتقال وجزر	مشروب طبيعي برتقال وجزر	\N	SIMPLE	10	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:33:24.921Z	f	f	58
3a240211-9f15-478b-9a82-0de9799cc797	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2fa37ae7-56e8-4bee-a59f-a5de98e66f55	ספרינג خوخ	ספרינג خوخ	\N	SIMPLE	6	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:33:57.262Z	f	f	59
41ea6545-157c-4ccf-9211-e2a25d1beb9a	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2fa37ae7-56e8-4bee-a59f-a5de98e66f55	ספרינג فواكه استوائية	ספרינג فواكه استوائية	\N	SIMPLE	6	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:34:48.553Z	f	f	60
58509fa7-76fc-404e-8f17-3a4dae85fd64	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2fa37ae7-56e8-4bee-a59f-a5de98e66f55	ספרינג توت موز	ספרינג توت موز	\N	SIMPLE	0	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:35:00.137Z	f	f	61
db6f7500-e3d2-4af1-9841-bb3bb3ffe564	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2fa37ae7-56e8-4bee-a59f-a5de98e66f55	ספרינג تفاح	ספרינג تفاح	\N	SIMPLE	6	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:35:24.920Z	f	f	62
e2658f4e-77ca-4cd6-a12c-e6d69048233d	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2fa37ae7-56e8-4bee-a59f-a5de98e66f55	ספרינג خوخ	ספרינג خوخ	\N	SIMPLE	6	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:35:46.873Z	f	f	63
6b1d438a-6a5e-495d-ad6b-409dc6ea5cf3	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2fa37ae7-56e8-4bee-a59f-a5de98e66f55	ספרינג مانجو	ספרינג مانجو	\N	SIMPLE	6	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:36:06.331Z	f	f	64
0d3e8106-22cd-4458-b367-5f2bf613c8aa	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2fa37ae7-56e8-4bee-a59f-a5de98e66f55	ريد بول زيرو	ريد بول زيرو	\N	SIMPLE	8	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:36:24.372Z	f	f	65
bfe8df4f-304e-45fa-a56c-f20010c08618	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	ريد بول	ريد بول	\N	SIMPLE	8	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:36:36.916Z	f	f	66
6e319ec1-8179-44a5-8f31-1ce8caaa3f85	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	صودا نعنع حامض	صودا نعنع حامض	\N	SIMPLE	5	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:36:54.397Z	f	f	67
dfbe6ac3-5319-469a-9a62-5394c64afa8a	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2fa37ae7-56e8-4bee-a59f-a5de98e66f55	صودا	صودا	\N	SIMPLE	5	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:37:13.259Z	f	f	68
5b1c06b8-917a-4c2b-a9d0-adfb36b0542b	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2fa37ae7-56e8-4bee-a59f-a5de98e66f55	صودا ليمون	صودا ليمون	\N	SIMPLE	5	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:37:36.412Z	f	f	69
f62f5d53-2cfe-4d33-9039-0faf41b8f5e1	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	صودا فواكه برية	صودا فواكه برية	\N	SIMPLE	8	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:37:50.608Z	f	f	70
559a67fb-ecea-4016-9dc8-9bb137388f83	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2fa37ae7-56e8-4bee-a59f-a5de98e66f55	صودا ليموناضة	صودا ليموناضة	\N	SIMPLE	8	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:38:10.662Z	f	f	71
56f8713d-c120-41d6-b68e-20668be21c33	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2fa37ae7-56e8-4bee-a59f-a5de98e66f55	صودا توت حامض	صودا توت حامض	\N	SIMPLE	8	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:38:32.766Z	f	f	72
107ef7d4-3baa-42c6-9a55-923716223a21	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2fa37ae7-56e8-4bee-a59f-a5de98e66f55	صودا خوخ	صودا خوخ	\N	SIMPLE	8	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:38:50.785Z	f	f	73
9dd54add-b0cf-4bce-8ee1-c422ebb648d1	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2fa37ae7-56e8-4bee-a59f-a5de98e66f55	صودا تفاح	صودا تفاح	\N	SIMPLE	8	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:39:21.366Z	f	f	74
15a27370-d0c8-4b91-9aec-775441abb2da	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	صودا موخيتو	صودا موخيتو	\N	SIMPLE	8	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:39:35.706Z	f	f	75
844ddea8-b92d-4413-b53b-9cc8357bf27c	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	blue عنب	blue عنب	\N	SIMPLE	5	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:40:01.692Z	f	f	76
4278e7bc-5da4-48b0-91e8-9aa682b683f2	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2fa37ae7-56e8-4bee-a59f-a5de98e66f55	blue توت	blue توت	\N	SIMPLE	5	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:40:19.918Z	f	f	77
caeced95-9f69-4875-a3cf-d7e4aed54b6d	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	d78f85d5-ed7b-4b62-9e8a-6069641e8c1a	موخيتو النعناع الكبير	موخيتو النعناع الكبير	\N	SIMPLE	15	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:20:18.926Z	f	f	49
a3d8228f-5f43-4e68-bcc1-24066e2c4ed0	62af86ec-0ef7-42fb-b707-c197cab8d05c	43d5145a-d272-4eca-bffc-f9475dde73d0	شنيتسل لخمنيا	شنيتسل لخمنيا	\N	SIMPLE	25	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:59:58.071Z	f	f	3
a122df8c-12a5-4965-ac4e-bc3a300c1512	62af86ec-0ef7-42fb-b707-c197cab8d05c	43d5145a-d272-4eca-bffc-f9475dde73d0	شنيتسل باجيت	شنيتسل باجيت	\N	SIMPLE	30	ILS	\N	[]	[]	[]	\N	t	2026-03-10T11:00:13.733Z	f	f	4
05d7ea17-02de-4042-9b61-b2949f061451	62af86ec-0ef7-42fb-b707-c197cab8d05c	43d5145a-d272-4eca-bffc-f9475dde73d0	شنيتسل جابيتا	شنيتسل جابيتا	\N	SIMPLE	30	ILS	\N	[]	[]	[]	\N	t	2026-03-10T11:00:43.333Z	f	f	5
7529ac51-076e-4be1-98c9-ead215dae36e	62af86ec-0ef7-42fb-b707-c197cab8d05c	43d5145a-d272-4eca-bffc-f9475dde73d0	صدر دجاج لخمنيا	صدر دجاج لخمنيا	\N	SIMPLE	25	ILS	\N	[]	[]	[]	\N	t	2026-03-10T11:01:00.777Z	f	f	6
b3a118c0-06a6-4ac8-be69-e886a83ad595	62af86ec-0ef7-42fb-b707-c197cab8d05c	43d5145a-d272-4eca-bffc-f9475dde73d0	صدر دجاج جابيتا	صدر دجاج جابيتا	\N	SIMPLE	30	ILS	\N	[]	[]	[]	\N	t	2026-03-10T11:01:45.765Z	f	f	8
8a864567-c5ea-4fe4-ac1a-ceb59f8f73ba	62af86ec-0ef7-42fb-b707-c197cab8d05c	43d5145a-d272-4eca-bffc-f9475dde73d0	كريسبي لخمنيا	كريسبي لخمنيا	\N	SIMPLE	25	ILS	\N	[]	[]	[]	\N	t	2026-03-10T11:02:38.607Z	f	f	9
c7f97b13-4ad7-421f-b0cf-44b16e460fcc	62af86ec-0ef7-42fb-b707-c197cab8d05c	43d5145a-d272-4eca-bffc-f9475dde73d0	كريسبي باجيت	كريسبي باجيت	\N	SIMPLE	30	ILS	\N	[]	[]	[]	\N	t	2026-03-10T11:02:56.481Z	f	f	10
f4ba929d-ca8f-4af9-a540-637c4e1b8fbd	62af86ec-0ef7-42fb-b707-c197cab8d05c	43d5145a-d272-4eca-bffc-f9475dde73d0	كريسبي جابيتا	كريسبي جابيتا	\N	SIMPLE	30	ILS	\N	[]	[]	[]	\N	t	2026-03-10T11:03:15.936Z	f	f	11
4fb335cb-2c10-4fcf-ab29-043f75d9b157	62af86ec-0ef7-42fb-b707-c197cab8d05c	43d5145a-d272-4eca-bffc-f9475dde73d0	شاورما عجل لخمنيا	شاورما عجل لخمنيا	\N	SIMPLE	35	ILS	\N	[]	[]	[]	\N	t	2026-03-10T11:03:40.332Z	f	f	12
2059ef24-93d2-40a4-a60e-109cd032a3a1	62af86ec-0ef7-42fb-b707-c197cab8d05c	43d5145a-d272-4eca-bffc-f9475dde73d0	شوارما عجل باجيت	شوارما عجل باجيت	\N	SIMPLE	40	ILS	\N	[]	[]	[]	\N	t	2026-03-10T11:04:13.508Z	f	f	13
798705d8-e20b-48ae-ad62-b828b61d7ab3	62af86ec-0ef7-42fb-b707-c197cab8d05c	43d5145a-d272-4eca-bffc-f9475dde73d0	رول مكسيكي	رول مكسيكي	\N	SIMPLE	25	ILS	\N	[]	[]	[]	\N	t	2026-03-10T11:04:31.330Z	f	f	14
714590ff-8361-4a69-baca-7d0a12c98a1b	62af86ec-0ef7-42fb-b707-c197cab8d05c	43d5145a-d272-4eca-bffc-f9475dde73d0	شاورما دجاج لخمنيا	شاورما دجاج لخمنيا	\N	SIMPLE	25	ILS	\N	[]	[]	[]	\N	t	2026-03-10T11:04:51.378Z	f	f	15
2c3b2ea1-95b6-4c9c-aa1f-350e45be84ac	62af86ec-0ef7-42fb-b707-c197cab8d05c	43d5145a-d272-4eca-bffc-f9475dde73d0	شاورما دجاج جابيتا	شاورما دجاج جابيتا	\N	SIMPLE	30	ILS	\N	[]	[]	[]	\N	t	2026-03-10T11:05:17.764Z	f	f	16
1aee2534-68a3-4118-8eed-5184d12e4a1b	62af86ec-0ef7-42fb-b707-c197cab8d05c	43d5145a-d272-4eca-bffc-f9475dde73d0	عجة لخمنيا	عجة لخمنيا	\N	SIMPLE	20	ILS	\N	[]	[]	[]	\N	t	2026-03-10T11:05:34.450Z	f	f	17
065611dd-af43-4cea-812c-d2bae1d7c156	62af86ec-0ef7-42fb-b707-c197cab8d05c	43d5145a-d272-4eca-bffc-f9475dde73d0	عجة باجيت 	عجة باجيت 	\N	SIMPLE	20	ILS	\N	[]	[]	[]	\N	t	2026-03-10T11:05:46.120Z	f	f	18
40f4cadb-97d5-4fa9-af78-34f9ae969f30	62af86ec-0ef7-42fb-b707-c197cab8d05c	43d5145a-d272-4eca-bffc-f9475dde73d0	توست اجبان لخمنيا	توست اجبان لخمنيا	\N	SIMPLE	15	ILS	\N	[]	[]	[]	\N	t	2026-03-10T11:06:07.860Z	f	f	19
5f663b33-a0ec-48d3-9669-c5f660abe3bf	62af86ec-0ef7-42fb-b707-c197cab8d05c	43d5145a-d272-4eca-bffc-f9475dde73d0	توست اجبان  بيجل	توست اجبان  بيجل	\N	SIMPLE	20	ILS	\N	[]	[]	[]	\N	t	2026-03-10T11:06:35.178Z	f	f	20
9f22b93b-bc79-467c-8272-82794d6b6fac	62af86ec-0ef7-42fb-b707-c197cab8d05c	1ca8a3be-7309-45e5-a9f0-24de44918ead	سلطة صدر دجاج	سلطة صدر دجاج	\N	SIMPLE	30	ILS	\N	[]	[]	[]	\N	t	2026-03-10T11:07:19.129Z	f	f	21
d3583ce4-38f1-4c3b-b2c9-cc41667c652e	62af86ec-0ef7-42fb-b707-c197cab8d05c	1ca8a3be-7309-45e5-a9f0-24de44918ead	سلطة شنيتسل	سلطة شنيتسل	\N	SIMPLE	30	ILS	\N	[]	[]	[]	\N	t	2026-03-10T11:08:38.955Z	f	f	22
bf85b0ca-a2df-4400-a90f-e2c0067d98a8	62af86ec-0ef7-42fb-b707-c197cab8d05c	1ca8a3be-7309-45e5-a9f0-24de44918ead	سلطة كريسبي	سلطة كريسبي	\N	SIMPLE	30	ILS	\N	[]	[]	[]	\N	t	2026-03-10T11:09:03.881Z	f	f	23
95f16fda-3d34-4df2-bfc6-8d1c3474136b	62af86ec-0ef7-42fb-b707-c197cab8d05c	1ca8a3be-7309-45e5-a9f0-24de44918ead	بطاطس مقلية	بطاطس مقلية	\N	SIMPLE	20	ILS	\N	[]	[]	[]	\N	t	2026-03-10T11:09:23.771Z	f	f	24
svc-lawyer-001	a7b8c9d0-e1f2-4a3b-8c9d-0e1f2a3b4c5d	cat-lawyer-001	استشارة قانونية م	legal-consultation	استشارة قانونية شاملة في مختلف المجالات	GENERAL	0	ILS		[{"id":"img-1","url":"","sortOrder":0}]	[]	[]	\N	t	2026-03-01T12:00:00.000Z	t	\N	0
c575a311-ea16-4ddb-b254-d9a43d549d37	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	cad82514-655f-4682-9ad8-24839dc45e8f	huda beauty blush	huda beauty blush	\N	SIMPLE	165	ILS	https://nmd.marketing/api/uploads/1772760597164-2e0o1wtl.webp	[{"id":"88450b0a-90f4-422b-a1eb-25b9a670489e","url":"https://nmd.marketing/api/uploads/1772760597164-2e0o1wtl.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:30:04.502Z	f	f	10
b866570e-ee58-4935-bc34-31d6d2cb2b40	62af86ec-0ef7-42fb-b707-c197cab8d05c	43d5145a-d272-4eca-bffc-f9475dde73d0	نقانق باجيت	نقانق باجيت	\N	SIMPLE	20	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:59:21.728Z	f	f	1
c218338d-35c1-4f05-b1e5-99678355a845	62af86ec-0ef7-42fb-b707-c197cab8d05c	43d5145a-d272-4eca-bffc-f9475dde73d0	نقانق لخمنيا	نقانق باجيت	\N	SIMPLE	10	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:59:39.465Z	f	f	2
fa91bbb3-0298-4005-92a8-b669d6946468	6d59233f-5edd-463b-b379-2697e5b6df34	fba36c55-c38e-451b-b73b-7ce91a3ba575	بيتسا	بيتسا	\N	SIMPLE	12	ILS	https://nmd.marketing/api/uploads/1772733151605-mumavn2a.webp	[{"id":"ce77a2ff-3f22-48e2-9451-a534178deb0c","url":"https://nmd.marketing/api/uploads/1772733151605-mumavn2a.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-05T17:52:33.206Z	f	f	5
0c1808f3-9319-4756-b90f-fcf8f2e92332	0c36235a-9473-4226-b091-71e3fb0efdc5	07fc715f-c51a-4774-b698-02cecbb39009	فوكاتشا زعتر 	فوكاتشا زعتر	زعتر خاص يمكن اضافة اللبنة	SIMPLE	15	ILS	https://nmd.marketing/api/uploads/1772744753812-unba1z3l.webp	[{"id":"ca11f824-7703-47f1-82c8-10ef3d943e83","url":"https://nmd.marketing/api/uploads/1772744753812-unba1z3l.webp","sortOrder":0}]	[{"id":"b26380a2-0c6b-4863-8ab4-0da87137a8e3","name":"اضافة","type":"CUSTOM","required":true,"minSelected":1,"maxSelected":1,"selectionType":"single","items":[{"id":"1d5c9b90-c9f3-41f3-9330-dc945da77fc6","name":"لبنة","sortOrder":0}]}]	[]	\N	t	2026-03-05T21:06:14.705Z	f	f	7
80b5f675-f851-49d1-9c87-ff66eef0c93d	f6e493da-e69f-4bbc-877b-8842a1dfb72e	94f42e0b-25c3-406d-8a58-d02613b74358	صفيحة دجاج	صفيحة دجاج	\N	SIMPLE	35	ILS	https://nmd.marketing/api/uploads/1772759638103-u5bz8v2p.webp	[{"id":"f34c7b56-48b7-49d4-ab7f-a71fff88d526","url":"https://nmd.marketing/api/uploads/1772759638103-u5bz8v2p.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-06T01:13:59.056Z	f	f	2
2b6506cd-c054-43e6-a95b-68fb6e930e66	2f663230-f9b3-463c-b8ab-eb55a5474b95	3f72a4ff-f5e3-428a-adca-467321eb9e83	قشطوطة فواكه	قشطوطة فواكه	\N	SIMPLE	35	ILS	https://nmd.marketing/api/uploads/1772871630045-hfx4qz2n.webp	[{"id":"84edb3ed-9b6b-429c-b9e6-f372a8e84b12","url":"https://nmd.marketing/api/uploads/1772871630045-hfx4qz2n.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:20:30.444Z	f	f	1
cf46df68-8905-4e7a-8d57-0d0521a83b74	2f663230-f9b3-463c-b8ab-eb55a5474b95	0a915473-a6f3-4438-bb08-fc143a46d943	موخيتو بطيخ	موخيتو بطيخ	\N	SIMPLE	22	ILS	https://nmd.marketing/api/uploads/1772871939067-e3d4jwr8.webp	[{"id":"328e4665-e5bb-47cb-b55b-0e4975a2ab29","url":"https://nmd.marketing/api/uploads/1772871939067-e3d4jwr8.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:25:42.621Z	f	f	13
de53887f-4654-4915-815a-0637067bd471	2f663230-f9b3-463c-b8ab-eb55a5474b95	7b43e146-2b38-4003-894a-44f1c6d127f9	ميلك شيك لوتوس	ميلك شيك لوتوس	\N	SIMPLE	25	ILS	https://nmd.marketing/api/uploads/1772872076292-6t15us1s.webp	[{"id":"cff17704-6ad7-4c80-9187-e320b7f986c4","url":"https://nmd.marketing/api/uploads/1772872076292-6t15us1s.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:27:56.885Z	f	f	20
4ffa7141-667b-46ad-aaa9-4190946813e0	2f663230-f9b3-463c-b8ab-eb55a5474b95	f5bfd656-d9c1-41e9-af52-41eb9b215cf9	فرفوشكا دبي	فرفوشكا دبي	\N	SIMPLE	35	ILS	https://nmd.marketing/api/uploads/1772872468432-dq47p6io.webp	[{"id":"cc310a31-4116-415f-9150-5e1dea15c3dc","url":"https://nmd.marketing/api/uploads/1772872468432-dq47p6io.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:34:28.980Z	f	f	27
24ffb759-6445-4272-b348-b6db8bbc3371	2f663230-f9b3-463c-b8ab-eb55a5474b95	81bc78b8-de83-41f8-b6fd-fecb9392deb3	كريب	كريب	\N	SIMPLE	25	ILS	https://nmd.marketing/api/uploads/1772873298782-ro5uwjf7.webp	[{"id":"d7a22f53-fbe6-4d71-ba98-8f1983cb5dd4","url":"https://nmd.marketing/api/uploads/1772873298782-ro5uwjf7.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T08:48:19.324Z	f	f	47
7fadfd65-c3a2-439c-836b-8efcb7a69dcd	2f663230-f9b3-463c-b8ab-eb55a5474b95	771dc16e-86b4-471b-91c4-61b4c754fafa	عصير جزر طبيعي	عصير جزر طبيعي	\N	SIMPLE	20	ILS	https://nmd.marketing/api/uploads/1772874111217-dvs1blrk.webp	[{"id":"5471e494-3e5a-4cfa-b2bd-62a63b3ed008","url":"https://nmd.marketing/api/uploads/1772874111217-dvs1blrk.webp","sortOrder":0}]	[]	[]	\N	t	2026-03-07T09:01:51.771Z	f	f	51
c021a669-e4ac-4ac8-a0d0-3ea93f321694	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	وافل الشوكلاتة	وافل الشوكلاتة	\N	SIMPLE	30	ILS	\N	[]	[{"id":"c358d252-8b92-4f5e-b02f-6d422c06b09f","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"شكولاتة","required":true,"minSelected":1,"maxSelected":1,"selectionType":"single","items":[{"id":"1a308d46-2983-402d-bf65-9407802bf176","groupId":"c358d252-8b92-4f5e-b02f-6d422c06b09f","name":"شوكلاطة بيضاء","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"eefaa9ca-183f-45c8-b528-0875b2c751ea","groupId":"c358d252-8b92-4f5e-b02f-6d422c06b09f","name":"شوكلاتة بنية","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false}]},{"id":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"اضافات","required":true,"minSelected":0,"maxSelected":3,"selectionType":"multi","items":[{"id":"2fc3955d-7eea-4fbe-bc2b-eaa5ee76850f","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"اوريو مطحون","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"b0bee7b5-f1fb-4fa0-84a9-f98a17d14836","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"لوتس مطحون","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false},{"id":"8437edb4-f4ac-486b-8e44-15e74b87f1b5","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"كليك بني","priceDelta":0,"sortOrder":2,"enabled":true,"defaultSelected":false},{"id":"1d8b4b74-6d06-4b27-8879-991443883694","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"كليك ابيض","priceDelta":0,"sortOrder":3,"enabled":true,"defaultSelected":false},{"id":"90735705-99fc-4c47-b08f-5095a6dbab7d","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"مكوبيلت بني","priceDelta":0,"sortOrder":4,"enabled":true,"defaultSelected":false},{"id":"253d8d6e-1276-45d8-b857-7b010dbfa4e9","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"مكوبيلت ابيض","priceDelta":0,"sortOrder":5,"enabled":true,"defaultSelected":false},{"id":"a250c44e-d977-46d9-b0a1-a46e2502618a","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"الدببة الصمغية","priceDelta":0,"sortOrder":6,"enabled":true,"defaultSelected":false},{"id":"5bd9fc6f-1fe5-49c4-87c7-304bc5f33b64","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"ملبس ملون","priceDelta":0,"sortOrder":7,"enabled":true,"defaultSelected":false},{"id":"c017f244-73fc-4df2-a147-c4724f30302e","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"الفول سوداني بوتنيم","priceDelta":0,"sortOrder":8,"enabled":true,"defaultSelected":false}]}]	[]	\N	t	2026-03-09T18:34:46.173Z	f	f	1
4be5e1fd-b69d-4c4b-86c8-2c157b9426c6	5b35539f-90e1-49cc-8c32-8d26cdce20f2	82a1f61b-eee2-4ed5-890d-8cf32b4e2151	jeans new collection	jeans new collection	\N	APPAREL	160	SAR	https://nmd.marketing/api/uploads/1772759276456-9wlppgpi.webp	[{"id":"220034e2-e460-4126-84e8-fed32b43469c","url":"https://nmd.marketing/api/uploads/1772759276456-9wlppgpi.webp","sortOrder":0}]	[{"id":"fd7e7ed3-8626-4cbc-beb2-02aef429de97","name":"مقاس","type":"SIZE","required":true,"minSelected":1,"maxSelected":1,"selectionType":"single","items":[{"id":"81c9f9a2-f14b-4fc1-99b4-ad302684e406","name":"40","sortOrder":0}]}]	[]	6	t	2026-02-13T15:58:33.389Z	f	f	0
9543c143-9a3c-4b96-94fc-3f9199d1d89c	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	كريب الشوكولاطة	كريب الشوكولاطة	\N	SIMPLE	30	ILS	\N	[]	[{"id":"c358d252-8b92-4f5e-b02f-6d422c06b09f","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"شكولاتة","required":true,"minSelected":1,"maxSelected":1,"selectionType":"single","items":[{"id":"1a308d46-2983-402d-bf65-9407802bf176","groupId":"c358d252-8b92-4f5e-b02f-6d422c06b09f","name":"شوكلاطة بيضاء","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"eefaa9ca-183f-45c8-b528-0875b2c751ea","groupId":"c358d252-8b92-4f5e-b02f-6d422c06b09f","name":"شوكلاتة بنية","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false}]},{"id":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"اضافات","required":true,"minSelected":0,"maxSelected":3,"selectionType":"multi","items":[{"id":"2fc3955d-7eea-4fbe-bc2b-eaa5ee76850f","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"اوريو مطحون","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"b0bee7b5-f1fb-4fa0-84a9-f98a17d14836","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"لوتس مطحون","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false},{"id":"8437edb4-f4ac-486b-8e44-15e74b87f1b5","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"كليك بني","priceDelta":0,"sortOrder":2,"enabled":true,"defaultSelected":false},{"id":"1d8b4b74-6d06-4b27-8879-991443883694","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"كليك ابيض","priceDelta":0,"sortOrder":3,"enabled":true,"defaultSelected":false},{"id":"90735705-99fc-4c47-b08f-5095a6dbab7d","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"مكوبيلت بني","priceDelta":0,"sortOrder":4,"enabled":true,"defaultSelected":false},{"id":"253d8d6e-1276-45d8-b857-7b010dbfa4e9","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"مكوبيلت ابيض","priceDelta":0,"sortOrder":5,"enabled":true,"defaultSelected":false},{"id":"a250c44e-d977-46d9-b0a1-a46e2502618a","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"الدببة الصمغية","priceDelta":0,"sortOrder":6,"enabled":true,"defaultSelected":false},{"id":"5bd9fc6f-1fe5-49c4-87c7-304bc5f33b64","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"ملبس ملون","priceDelta":0,"sortOrder":7,"enabled":true,"defaultSelected":false},{"id":"c017f244-73fc-4df2-a147-c4724f30302e","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"الفول سوداني بوتنيم","priceDelta":0,"sortOrder":8,"enabled":true,"defaultSelected":false}]}]	[]	\N	t	2026-03-09T18:35:39.401Z	f	f	3
d249df01-8f85-4ec9-b1fc-69e423ec3b5b	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	دوناتس	دوناتس	6 وحدات من الدونات مع الشوكلاطة	SIMPLE	30	ILS	\N	[]	[{"id":"c358d252-8b92-4f5e-b02f-6d422c06b09f","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"شكولاتة","required":true,"minSelected":1,"maxSelected":1,"selectionType":"single","items":[{"id":"1a308d46-2983-402d-bf65-9407802bf176","groupId":"c358d252-8b92-4f5e-b02f-6d422c06b09f","name":"شوكلاطة بيضاء","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"eefaa9ca-183f-45c8-b528-0875b2c751ea","groupId":"c358d252-8b92-4f5e-b02f-6d422c06b09f","name":"شوكلاتة بنية","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false}]},{"id":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"اضافات","required":true,"minSelected":0,"maxSelected":3,"selectionType":"multi","items":[{"id":"2fc3955d-7eea-4fbe-bc2b-eaa5ee76850f","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"اوريو مطحون","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"b0bee7b5-f1fb-4fa0-84a9-f98a17d14836","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"لوتس مطحون","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false},{"id":"8437edb4-f4ac-486b-8e44-15e74b87f1b5","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"كليك بني","priceDelta":0,"sortOrder":2,"enabled":true,"defaultSelected":false},{"id":"1d8b4b74-6d06-4b27-8879-991443883694","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"كليك ابيض","priceDelta":0,"sortOrder":3,"enabled":true,"defaultSelected":false},{"id":"90735705-99fc-4c47-b08f-5095a6dbab7d","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"مكوبيلت بني","priceDelta":0,"sortOrder":4,"enabled":true,"defaultSelected":false},{"id":"253d8d6e-1276-45d8-b857-7b010dbfa4e9","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"مكوبيلت ابيض","priceDelta":0,"sortOrder":5,"enabled":true,"defaultSelected":false},{"id":"a250c44e-d977-46d9-b0a1-a46e2502618a","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"الدببة الصمغية","priceDelta":0,"sortOrder":6,"enabled":true,"defaultSelected":false},{"id":"5bd9fc6f-1fe5-49c4-87c7-304bc5f33b64","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"ملبس ملون","priceDelta":0,"sortOrder":7,"enabled":true,"defaultSelected":false},{"id":"c017f244-73fc-4df2-a147-c4724f30302e","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"الفول سوداني بوتنيم","priceDelta":0,"sortOrder":8,"enabled":true,"defaultSelected":false}]}]	[]	\N	t	2026-03-09T19:27:20.480Z	f	f	9
c84fd93e-03bc-4068-acef-a3e87f376ba0	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	عصير تفاح كبير	عصير تفاح كبير	\N	SIMPLE	15	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:08:02.383Z	f	f	31
737981a0-9b13-4859-b194-8f3375bc33c8	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	غصير برتقال جزر صغير	غصير برتقال جزر صغير	\N	SIMPLE	15	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:08:36.155Z	f	f	32
70685e43-d5b2-49d5-8244-05ca9977ab62	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	d78f85d5-ed7b-4b62-9e8a-6069641e8c1a	موخيتو النعناع الصغير	موخيتو النعناع الصغير	\N	SIMPLE	10	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:20:01.268Z	f	f	48
0a5c3717-f6b0-4899-aaaf-59a9d0a44eba	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2fa37ae7-56e8-4bee-a59f-a5de98e66f55	مشروب طبيعي اناناس برتقال جزر	مشروب طبيعي اناناس برتقال جزر	\N	SIMPLE	10	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:31:20.160Z	f	f	54
cbe988fd-ff60-4427-b612-40dea020758d	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	blue 	blue 	\N	SIMPLE	5	ILS	\N	[]	[]	[]	\N	t	2026-03-10T10:41:34.607Z	f	f	80
be4de23c-57e3-4c96-adfa-99c388c09166	62af86ec-0ef7-42fb-b707-c197cab8d05c	43d5145a-d272-4eca-bffc-f9475dde73d0	صدر دجاج باجيت	صدر دجاج باجيت	\N	SIMPLE	30	ILS	\N	[]	[]	[]	\N	t	2026-03-10T11:01:25.287Z	f	f	7
c910f5d5-846b-4178-8a07-83ca1e51d096	1cc59722-3687-45a1-9121-e7a608fba225	15a1b5ad-bd38-4fb5-b948-7962f9755463	بيتسا عائلية	بيتسا عائلية	\N	PIZZA	60	ILS	https://nmd.marketing/api/uploads/1772734099290-bvnbofpp.webp	[{"id":"65d3a003-3ddf-4b6f-99b8-19f67ff2a30f","url":"https://nmd.marketing/api/uploads/1772734099290-bvnbofpp.webp","sortOrder":0}]	[{"id":"ea13eb47-0d4c-442a-b16a-871d3d524abd","name":"اضافاات","type":"CUSTOM","required":true,"minSelected":1,"maxSelected":1,"selectionType":"single","items":[{"id":"9097f4db-0221-4567-8483-7f3a2dd0cc08","name":"زيتون","sortOrder":0,"placement":"HALF"},{"id":"ec436bf9-cc19-466f-83d0-27c7845cabfd","name":"زيتون اسود","sortOrder":1,"placement":"HALF"},{"id":"aff00b65-0403-42eb-abcb-020be4d73771","name":"بصل","sortOrder":2,"placement":"HALF"},{"id":"ea8ca896-6b91-4911-936b-d441ea367be0","name":"ذرة","sortOrder":3,"placement":"HALF"},{"id":"17a0d6b3-2333-4a39-be7c-556cab25f203","name":"بندورة","sortOrder":4,"placement":"HALF"},{"id":"bf3f4f10-dfc2-4b9b-b6fb-ac142a7451d1","name":"فلفل حلو","sortOrder":5,"placement":"HALF"},{"id":"a73b444c-86f5-4e06-81f9-f1ff54771177","name":"فلفل حار","sortOrder":6,"placement":"HALF"},{"id":"6be8d1a3-4b6a-4ae9-8171-caaeeaa964db","name":"فطر","sortOrder":7,"placement":"HALF"},{"id":"f7b0f36c-6620-455d-a01d-282d144c0555","name":"تونة","sortOrder":8,"placement":"HALF"},{"id":"07ad62d3-28a4-482a-91f4-bcc52185d823","name":"ببروني","sortOrder":9,"placement":"HALF"},{"id":"4d511c25-9401-4c5e-90ed-41a7cd8ce232","name":"ثوم","sortOrder":10,"placement":"HALF"}],"allowHalfPlacement":true}]	[]	\N	t	2026-03-05T18:09:26.273Z	f	f	1
7c72dcf5-a510-4aef-b691-0bb00e10cfc2	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	كريب الفستق	كريب الفستق	كريب فاخر محشو بالفستق	SIMPLE	40	ILS	\N	[]	[{"id":"c358d252-8b92-4f5e-b02f-6d422c06b09f","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"شكولاتة","required":true,"minSelected":1,"maxSelected":1,"selectionType":"single","items":[{"id":"1a308d46-2983-402d-bf65-9407802bf176","groupId":"c358d252-8b92-4f5e-b02f-6d422c06b09f","name":"شوكلاطة بيضاء","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"eefaa9ca-183f-45c8-b528-0875b2c751ea","groupId":"c358d252-8b92-4f5e-b02f-6d422c06b09f","name":"شوكلاتة بنية","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false}]},{"id":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"اضافات","required":true,"minSelected":0,"maxSelected":3,"selectionType":"multi","items":[{"id":"2fc3955d-7eea-4fbe-bc2b-eaa5ee76850f","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"اوريو مطحون","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"b0bee7b5-f1fb-4fa0-84a9-f98a17d14836","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"لوتس مطحون","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false},{"id":"8437edb4-f4ac-486b-8e44-15e74b87f1b5","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"كليك بني","priceDelta":0,"sortOrder":2,"enabled":true,"defaultSelected":false},{"id":"1d8b4b74-6d06-4b27-8879-991443883694","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"كليك ابيض","priceDelta":0,"sortOrder":3,"enabled":true,"defaultSelected":false},{"id":"90735705-99fc-4c47-b08f-5095a6dbab7d","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"مكوبيلت بني","priceDelta":0,"sortOrder":4,"enabled":true,"defaultSelected":false},{"id":"253d8d6e-1276-45d8-b857-7b010dbfa4e9","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"مكوبيلت ابيض","priceDelta":0,"sortOrder":5,"enabled":true,"defaultSelected":false},{"id":"a250c44e-d977-46d9-b0a1-a46e2502618a","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"الدببة الصمغية","priceDelta":0,"sortOrder":6,"enabled":true,"defaultSelected":false},{"id":"5bd9fc6f-1fe5-49c4-87c7-304bc5f33b64","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"ملبس ملون","priceDelta":0,"sortOrder":7,"enabled":true,"defaultSelected":false},{"id":"c017f244-73fc-4df2-a147-c4724f30302e","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"الفول سوداني بوتنيم","priceDelta":0,"sortOrder":8,"enabled":true,"defaultSelected":false}]}]	[]	\N	t	2026-03-09T18:35:14.999Z	f	f	2
444d0bb2-1a6b-404e-b8b9-e10e036f0336	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	2005cb3b-70d5-4b5e-a4ef-b144f636c28d	تشوروس	تشوروس	6 وحدات تشوروس مع الشوكلاطة	SIMPLE	25	ILS	\N	[]	[{"id":"c358d252-8b92-4f5e-b02f-6d422c06b09f","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"شكولاتة","required":true,"minSelected":1,"maxSelected":1,"selectionType":"single","items":[{"id":"1a308d46-2983-402d-bf65-9407802bf176","groupId":"c358d252-8b92-4f5e-b02f-6d422c06b09f","name":"شوكلاطة بيضاء","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"eefaa9ca-183f-45c8-b528-0875b2c751ea","groupId":"c358d252-8b92-4f5e-b02f-6d422c06b09f","name":"شوكلاتة بنية","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false}]},{"id":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"اضافات","required":true,"minSelected":0,"maxSelected":3,"selectionType":"multi","items":[{"id":"2fc3955d-7eea-4fbe-bc2b-eaa5ee76850f","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"اوريو مطحون","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"b0bee7b5-f1fb-4fa0-84a9-f98a17d14836","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"لوتس مطحون","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false},{"id":"8437edb4-f4ac-486b-8e44-15e74b87f1b5","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"كليك بني","priceDelta":0,"sortOrder":2,"enabled":true,"defaultSelected":false},{"id":"1d8b4b74-6d06-4b27-8879-991443883694","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"كليك ابيض","priceDelta":0,"sortOrder":3,"enabled":true,"defaultSelected":false},{"id":"90735705-99fc-4c47-b08f-5095a6dbab7d","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"مكوبيلت بني","priceDelta":0,"sortOrder":4,"enabled":true,"defaultSelected":false},{"id":"253d8d6e-1276-45d8-b857-7b010dbfa4e9","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"مكوبيلت ابيض","priceDelta":0,"sortOrder":5,"enabled":true,"defaultSelected":false},{"id":"a250c44e-d977-46d9-b0a1-a46e2502618a","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"الدببة الصمغية","priceDelta":0,"sortOrder":6,"enabled":true,"defaultSelected":false},{"id":"5bd9fc6f-1fe5-49c4-87c7-304bc5f33b64","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"ملبس ملون","priceDelta":0,"sortOrder":7,"enabled":true,"defaultSelected":false},{"id":"c017f244-73fc-4df2-a147-c4724f30302e","groupId":"8f8dbafc-a0f5-493e-933c-b0d4317f5807","name":"الفول سوداني بوتنيم","priceDelta":0,"sortOrder":8,"enabled":true,"defaultSelected":false}]}]	[]	\N	t	2026-03-09T19:28:10.502Z	f	f	10
a95f6f29-263f-4dff-8f54-bdabed2c3e28	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	4a153659-44de-4068-9405-fa73a3c53f49	ا كيلو بوظة	ا كيلو بوظة	\N	SIMPLE	60	ILS	\N	[]	[{"id":"d029d825-038b-40b5-af65-c981f8ba40ba","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"بوظة","required":false,"minSelected":1,"maxSelected":6,"selectionType":"multi","items":[{"id":"1f7d1706-bcd9-4f2e-b8b2-71cefab57a2d","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"اوريو","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"1050b1b6-af2b-4893-ac62-282d0e97611f","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"لوتوس","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false},{"id":"b8e43810-6ddb-41b7-bbb8-5c9ca6182e2e","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"كيندر","priceDelta":0,"sortOrder":2,"enabled":true,"defaultSelected":false},{"id":"f972d0f9-0c51-4d92-9db2-1821c7d7f1ef","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"مكوبيلت","priceDelta":0,"sortOrder":3,"enabled":true,"defaultSelected":false},{"id":"728c7868-da19-498d-9c18-7e7ce6c43a64","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"علكة ","priceDelta":0,"sortOrder":4,"enabled":true,"defaultSelected":false},{"id":"5c9068d3-fcb9-4754-b0c2-3404cdc183f9","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"مارشميلو","priceDelta":0,"sortOrder":5,"enabled":true,"defaultSelected":false},{"id":"abbff3f4-4f24-40e3-b760-6c332cf7da35","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"فيريرو روشيه","priceDelta":0,"sortOrder":6,"enabled":true,"defaultSelected":false},{"id":"21fcb80d-114c-4917-83a6-be25fb2cd4d3","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"فواكه بريه (بيروت ياعر )","priceDelta":0,"sortOrder":7,"enabled":true,"defaultSelected":false},{"id":"fbafe2e9-8d3e-452d-a488-319da669715c","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"بسفلورا","priceDelta":0,"sortOrder":8,"enabled":true,"defaultSelected":false},{"id":"b61585e5-ec5a-4036-b07a-7eb10ad8bcc5","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"كراميل ريبات حلاف","priceDelta":0,"sortOrder":9,"enabled":true,"defaultSelected":false},{"id":"81abe5cb-6ae5-4083-a16f-4ed6a7c0d82d","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"كليك","priceDelta":0,"sortOrder":11,"enabled":true,"defaultSelected":false},{"id":"1b293a4e-f8fc-474b-a3b8-aeccb017de7c","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"شوكلاتة دبي","priceDelta":0,"sortOrder":12,"enabled":true,"defaultSelected":false},{"id":"c39d64b1-4d75-49e9-8079-56e3bec3863e","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"توت شمينت","priceDelta":0,"sortOrder":12,"enabled":true,"defaultSelected":false},{"id":"63914c55-73fd-4fd7-b726-4978ad30f666","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"كرز","priceDelta":0,"sortOrder":13,"enabled":true,"defaultSelected":false}]}]	[]	\N	t	2026-03-10T10:09:53.818Z	f	f	35
61772c1c-18cf-4b33-81d1-956a2e849c97	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	4a153659-44de-4068-9405-fa73a3c53f49	0.5 كيلو بوظة	0.5 كيلو بوظة	\N	SIMPLE	30	ILS	\N	[]	[{"id":"d029d825-038b-40b5-af65-c981f8ba40ba","tenantId":"bb3c5210-7dfc-46ee-a54a-7771ad32ee2a","name":"بوظة","required":false,"minSelected":1,"maxSelected":6,"selectionType":"multi","items":[{"id":"1f7d1706-bcd9-4f2e-b8b2-71cefab57a2d","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"اوريو","priceDelta":0,"sortOrder":0,"enabled":true,"defaultSelected":false},{"id":"1050b1b6-af2b-4893-ac62-282d0e97611f","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"لوتوس","priceDelta":0,"sortOrder":1,"enabled":true,"defaultSelected":false},{"id":"b8e43810-6ddb-41b7-bbb8-5c9ca6182e2e","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"كيندر","priceDelta":0,"sortOrder":2,"enabled":true,"defaultSelected":false},{"id":"f972d0f9-0c51-4d92-9db2-1821c7d7f1ef","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"مكوبيلت","priceDelta":0,"sortOrder":3,"enabled":true,"defaultSelected":false},{"id":"728c7868-da19-498d-9c18-7e7ce6c43a64","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"علكة ","priceDelta":0,"sortOrder":4,"enabled":true,"defaultSelected":false},{"id":"5c9068d3-fcb9-4754-b0c2-3404cdc183f9","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"مارشميلو","priceDelta":0,"sortOrder":5,"enabled":true,"defaultSelected":false},{"id":"abbff3f4-4f24-40e3-b760-6c332cf7da35","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"فيريرو روشيه","priceDelta":0,"sortOrder":6,"enabled":true,"defaultSelected":false},{"id":"21fcb80d-114c-4917-83a6-be25fb2cd4d3","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"فواكه بريه (بيروت ياعر )","priceDelta":0,"sortOrder":7,"enabled":true,"defaultSelected":false},{"id":"fbafe2e9-8d3e-452d-a488-319da669715c","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"بسفلورا","priceDelta":0,"sortOrder":8,"enabled":true,"defaultSelected":false},{"id":"b61585e5-ec5a-4036-b07a-7eb10ad8bcc5","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"كراميل ريبات حلاف","priceDelta":0,"sortOrder":9,"enabled":true,"defaultSelected":false},{"id":"81abe5cb-6ae5-4083-a16f-4ed6a7c0d82d","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"كليك","priceDelta":0,"sortOrder":11,"enabled":true,"defaultSelected":false},{"id":"1b293a4e-f8fc-474b-a3b8-aeccb017de7c","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"شوكلاتة دبي","priceDelta":0,"sortOrder":12,"enabled":true,"defaultSelected":false},{"id":"c39d64b1-4d75-49e9-8079-56e3bec3863e","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"توت شمينت","priceDelta":0,"sortOrder":12,"enabled":true,"defaultSelected":false},{"id":"63914c55-73fd-4fd7-b726-4978ad30f666","groupId":"d029d825-038b-40b5-af65-c981f8ba40ba","name":"كرز","priceDelta":0,"sortOrder":13,"enabled":true,"defaultSelected":false}]}]	[]	\N	t	2026-03-10T10:10:29.884Z	f	f	36
\.


--
-- Data for Name: Contest; Type: TABLE DATA; Schema: public; Owner: nmd
--

COPY public."Contest" (id, title, description, type, options, "correctAnswer", "isActive", "rewardCode", "expiresAt", "createdAt", "bannerImageUrl", "teamAName", "teamBName", "isPrediction", "finalScoreA", "finalScoreB") FROM stdin;
contest-1773156538640-axegubw	نيوكاسل X برشلونة	توقع النتيجة واحصل على توصيل مجاني	PREDICTION	\N	\N	t	win2229	2026-03-10T19:59:00.000Z	2026-03-10T15:28:58.640Z	https://nmd.marketing/api/uploads/1773156520839-t6p3klr3.webp	برشلونة	نيوكاسل	t	\N	\N
\.


--
-- Data for Name: ContestParticipation; Type: TABLE DATA; Schema: public; Owner: nmd
--

COPY public."ContestParticipation" (id, "customerId", "contestId", "userAnswer", "isWinner", "createdAt", "scoreA", "scoreB") FROM stdin;
cp-1773157163483-8u7n95a	customer-3bf4ba86-362f-43fd-aa0a-a89ba8c61f56	contest-1773156538640-axegubw	3-1	f	2026-03-10T15:39:23.482Z	3	1
cp-1773157695093-xmb9v64	customer-31259e61-a776-450c-88fb-aaeb406eb76d	contest-1773156538640-axegubw	2-0	f	2026-03-10T15:48:15.086Z	2	0
cp-1773159262652-naootb6	customer-0d1b9cea-e5b9-4fd8-92d5-f8493bda0c48	contest-1773156538640-axegubw	2-3	f	2026-03-10T16:14:22.651Z	2	3
\.


--
-- Data for Name: Courier; Type: TABLE DATA; Schema: public; Owner: nmd
--

COPY public."Courier" (id, "scopeType", "scopeId", "marketId", name, phone, "isActive", "isOnline", capacity, "isAvailable", "deliveryCount") FROM stdin;
courier-50971b77-4811-49e8-825b-78bd84041782	MARKET	market-dabburiyya	market-dabburiyya	احمد	0546111668	t	t	3	t	28
courier-dab-002	MARKET	market-dabburiyya	market-dabburiyya	خالد	0542223344	t	t	3	f	12
courier-dab-003	MARKET	market-dabburiyya	market-dabburiyya	محمود	0543334455	t	t	2	f	5
courier-iksal-001	MARKET	market-iksal	market-iksal	سائق إكسال	0541234567	t	t	3	t	0
courier-iksal-002	MARKET	market-iksal	market-iksal	عمر	0545556677	t	t	3	t	8
\.


--
-- Data for Name: Customer; Type: TABLE DATA; Schema: public; Owner: nmd
--

COPY public."Customer" (id, phone, name, "createdAt") FROM stdin;
customer-8012c0f1-9015-4011-9524-f581f96c4d94	0501234567	\N	2026-02-16T12:06:18.478Z
customer-3bf4ba86-362f-43fd-aa0a-a89ba8c61f56	0546111668	فواز عزايزة	2026-03-02T01:28:48.296Z
customer-5efc0ab9-800f-4da6-9e4b-00a7af69e873	0544844187	Rand	2026-03-02T19:48:32.835Z
customer-31259e61-a776-450c-88fb-aaeb406eb76d	0505124617	رازي سليم	2026-03-05T21:25:13.079Z
customer-7f5238f2-d75b-4708-9285-216ad0604df0	0546340035	الاء	2026-03-06T20:06:58.061Z
customer-0d1b9cea-e5b9-4fd8-92d5-f8493bda0c48	‏0507162162	يزيد اطرش	2026-03-06T21:15:20.206Z
customer-e1e39a08-0645-43bf-b68b-025f40ca9735	0528150750	اسعد سموعي	2026-03-06T21:40:01.760Z
customer-08baa216-bd47-4841-a268-f315096e8fe1	0507213180	MAY SAOUB	2026-03-07T11:03:49.302Z
\.


--
-- Data for Name: DeliveryZone; Type: TABLE DATA; Schema: public; Owner: nmd
--

COPY public."DeliveryZone" (id, "tenantId", name, fee, "etaMinutes", "minimumOrder", geo, "isActive", "sortOrder") FROM stdin;
default-zone	default	المنطقة الافتراضية	0	30	0	\N	t	0
dz-0e742787-cd4f-4439-ac4f-3ec944ba7de0-1	0e742787-cd4f-4439-ac4f-3ec944ba7de0	دبورية	15	\N	\N	\N	t	0
dz-0e742787-cd4f-4439-ac4f-3ec944ba7de0-2	0e742787-cd4f-4439-ac4f-3ec944ba7de0	الشبلي / أم الغنم	25	\N	\N	\N	t	1
dz-0e742787-cd4f-4439-ac4f-3ec944ba7de0-3	0e742787-cd4f-4439-ac4f-3ec944ba7de0	القرى الزعبية	40	\N	\N	\N	t	2
dz-0e742787-cd4f-4439-ac4f-3ec944ba7de0-4	0e742787-cd4f-4439-ac4f-3ec944ba7de0	إكسال	35	\N	\N	\N	t	3
dz-e4704bdc-a7ee-414a-8eb1-3663e4a40fa9-1	e4704bdc-a7ee-414a-8eb1-3663e4a40fa9	دبورية	15	\N	\N	\N	t	0
dz-e4704bdc-a7ee-414a-8eb1-3663e4a40fa9-2	e4704bdc-a7ee-414a-8eb1-3663e4a40fa9	الشبلي / أم الغنم	25	\N	\N	\N	t	1
0ad52d89-fb14-4a9a-b6b3-2c5efa9aaa94	5b35539f-90e1-49cc-8c32-8d26cdce20f2	القرى الزعبية	40	0	\N	\N	t	2
8362e2fc-9f96-49d8-920b-6b8aca6b2cbc	5b35539f-90e1-49cc-8c32-8d26cdce20f2	اكسال	30	0	\N	\N	t	3
3871f209-9f9e-43c5-b0c0-39948828b59b	f741d517-e7e6-48c9-a046-18d85acf1d25	دبوريه 	15	0	\N	\N	t	0
8ca7c3a4-920a-4565-9319-41cbdc2d0346	f741d517-e7e6-48c9-a046-18d85acf1d25	الشبلي/ام الغنم 	25	0	\N	\N	t	1
de145b33-56f8-43b3-bc1d-d856ee97aea4	f741d517-e7e6-48c9-a046-18d85acf1d25	القرى الزعبية	40	0	\N	\N	t	2
60fe0154-b474-44c5-a6d2-70cad9cb61c6	f741d517-e7e6-48c9-a046-18d85acf1d25	اكسال	30	0	\N	\N	t	3
9506533e-abc5-4ade-81e0-94eec70c79d3	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	دبوريه 	15	0	\N	\N	t	0
6fea2722-8946-4079-a1a4-f32002e4ee2b	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	الشبلي/ام الغنم 	25	0	\N	\N	t	1
e95b8cf8-8620-49ae-a99c-ac5b867083d8	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	القرى الزعبية	40	0	\N	\N	t	2
d9d690d9-d62e-450c-991c-2deff10520d5	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	اكسال	30	0	\N	\N	t	3
e9cc9d8e-62db-4ca8-b2c9-2f932327686e	1cc59722-3687-45a1-9121-e7a608fba225	دبوريه 	15	0	\N	\N	t	0
f0444720-9241-4126-8233-48287d18fdca	1cc59722-3687-45a1-9121-e7a608fba225	القرى الزعبية	40	0	\N	\N	t	2
c2a45055-51c3-4b04-bd6a-14f366e90b7e	1cc59722-3687-45a1-9121-e7a608fba225	اكسال	30	0	\N	\N	t	3
5281ca33-2cfa-4016-9929-a3b3c64299b0	60904bcc-970a-45e3-8669-8015ee2afe64	دبوريه 	15	0	\N	\N	t	0
58836db1-4852-456f-92fa-4622e1052e73	60904bcc-970a-45e3-8669-8015ee2afe64	الشبلي/ام الغنم 	25	0	\N	\N	t	1
5ac62dd1-ade8-49fd-ae5d-ddb131b40d91	60904bcc-970a-45e3-8669-8015ee2afe64	القرى الزعبية	40	0	\N	\N	t	2
51c5dc8e-3a64-493e-ad7f-ad2b2157e357	60904bcc-970a-45e3-8669-8015ee2afe64	اكسال	30	0	\N	\N	t	3
800a479e-1d7a-4f69-9b7e-2a7ef31d8ace	a7b8c9d0-e1f2-4a3b-8c9d-0e1f2a3b4c5d	دبوريه 	15	0	\N	\N	t	0
35982cc0-e875-4f2d-bd1a-f62a00da35b8	a7b8c9d0-e1f2-4a3b-8c9d-0e1f2a3b4c5d	الشبلي/ام الغنم 	25	0	\N	\N	t	1
94499c00-59ed-4040-8f0d-4a8a94eaffa3	a7b8c9d0-e1f2-4a3b-8c9d-0e1f2a3b4c5d	القرى الزعبية	40	0	\N	\N	t	2
1e9bd2a3-7cc7-449a-abc1-9d6d769e5e93	a7b8c9d0-e1f2-4a3b-8c9d-0e1f2a3b4c5d	اكسال	30	0	\N	\N	t	3
dz-1c6f3866-a475-445e-8806-42065adea654-1	1c6f3866-a475-445e-8806-42065adea654	المنطقة الافتراضية	10	45	\N	\N	t	0
cf7ccc8d-46c6-4bd1-9a79-2184ab34e795	6d59233f-5edd-463b-b379-2697e5b6df34	دبوريه 	15	0	\N	\N	t	0
3ce0196b-325a-46af-9bca-4800b56808f3	6d59233f-5edd-463b-b379-2697e5b6df34	الشبلي/ام الغنم 	25	0	\N	\N	t	1
f84711fd-4dde-4bd2-b87f-1cd3a97cffe0	6d59233f-5edd-463b-b379-2697e5b6df34	القرى الزعبية	40	0	\N	\N	t	2
1701acb1-55b1-4aca-b713-e00f20003c4b	6d59233f-5edd-463b-b379-2697e5b6df34	اكسال	30	0	\N	\N	t	3
abd4f9f5-ac05-446f-8a51-65964ef7aac8	0c36235a-9473-4226-b091-71e3fb0efdc5	دبوريه 	15	0	\N	\N	t	0
566a4bdc-2b0b-4123-af90-c004ea80ce71	0c36235a-9473-4226-b091-71e3fb0efdc5	الشبلي/ام الغنم 	25	0	\N	\N	t	1
d33d7051-afd9-4433-951a-6ea132f1958b	0c36235a-9473-4226-b091-71e3fb0efdc5	القرى الزعبية	40	0	\N	\N	t	2
81fe2517-cd0e-4969-9572-1bdd29863866	0c36235a-9473-4226-b091-71e3fb0efdc5	اكسال	30	0	\N	\N	t	3
c600b900-1a26-4c31-8f3d-0f9cdb19ab0f	f6e493da-e69f-4bbc-877b-8842a1dfb72e	دبوريه 	15	0	\N	\N	t	0
c84fd5c2-3e67-420c-a80c-a8412a93a356	f6e493da-e69f-4bbc-877b-8842a1dfb72e	الشبلي/ام الغنم 	25	0	\N	\N	t	1
23c77ecf-ed75-4c97-a979-5cb39ff1ec42	f6e493da-e69f-4bbc-877b-8842a1dfb72e	القرى الزعبية	40	0	\N	\N	t	2
4966978b-09db-4371-90cd-e44e44d5077d	f6e493da-e69f-4bbc-877b-8842a1dfb72e	اكسال	30	0	\N	\N	t	3
2ff4ce1f-8631-454a-9b54-cdd93b15fd69	b48b688d-fb40-4dd8-86da-b3d34dd1fffc	دبوريه 	15	0	\N	\N	t	0
9ce87591-fa6e-4e17-967e-fadfb1b8760f	b48b688d-fb40-4dd8-86da-b3d34dd1fffc	الشبلي/ام الغنم 	25	0	\N	\N	t	1
a1d02fd2-54d4-4f98-abfb-c153f4fff00b	b48b688d-fb40-4dd8-86da-b3d34dd1fffc	القرى الزعبية	40	0	\N	\N	t	2
46817e98-a680-4ef6-9e39-b79527a7d1de	b48b688d-fb40-4dd8-86da-b3d34dd1fffc	اكسال	30	0	\N	\N	t	3
e88cad83-01ba-4614-a675-40da9244b1bf	2f663230-f9b3-463c-b8ab-eb55a5474b95	دبوريه 	15	0	\N	\N	t	0
9e87d2fd-2dfe-45fc-85bd-25bf86e6e50e	2f663230-f9b3-463c-b8ab-eb55a5474b95	الشبلي/ام الغنم 	25	0	\N	\N	t	1
1672f7e0-d6cb-46e5-8722-f00f7d12eddc	2f663230-f9b3-463c-b8ab-eb55a5474b95	القرى الزعبية	40	0	\N	\N	t	2
6e16806b-3aa9-407c-8390-80eb39ba8e75	2f663230-f9b3-463c-b8ab-eb55a5474b95	اكسال	30	0	\N	\N	t	3
220a4e42-daaf-4130-9b41-6d8ccf4fae5f	5b35539f-90e1-49cc-8c32-8d26cdce20f2	الشبلي/ام الغنم 	25	0	\N	\N	t	1
dz-e4704bdc-a7ee-414a-8eb1-3663e4a40fa9-3	e4704bdc-a7ee-414a-8eb1-3663e4a40fa9	القرى الزعبية	40	\N	\N	\N	t	2
dz-e4704bdc-a7ee-414a-8eb1-3663e4a40fa9-4	e4704bdc-a7ee-414a-8eb1-3663e4a40fa9	إكسال	35	\N	\N	\N	t	3
dz-bb3c5210-7dfc-46ee-a54a-7771ad32ee2a-1	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	دبورية	15	\N	\N	\N	t	0
dz-bb3c5210-7dfc-46ee-a54a-7771ad32ee2a-2	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	الشبلي / أم الغنم	25	\N	\N	\N	t	1
dz-bb3c5210-7dfc-46ee-a54a-7771ad32ee2a-3	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	القرى الزعبية	40	\N	\N	\N	t	2
dz-bb3c5210-7dfc-46ee-a54a-7771ad32ee2a-4	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	إكسال	35	\N	\N	\N	t	3
dz-3eb37051-3217-489f-a471-5927cab34b0d-1	3eb37051-3217-489f-a471-5927cab34b0d	دبورية	15	\N	\N	\N	t	0
dz-3eb37051-3217-489f-a471-5927cab34b0d-2	3eb37051-3217-489f-a471-5927cab34b0d	الشبلي / أم الغنم	25	\N	\N	\N	t	1
dz-3eb37051-3217-489f-a471-5927cab34b0d-3	3eb37051-3217-489f-a471-5927cab34b0d	القرى الزعبية	40	\N	\N	\N	t	2
dz-3eb37051-3217-489f-a471-5927cab34b0d-4	3eb37051-3217-489f-a471-5927cab34b0d	إكسال	35	\N	\N	\N	t	3
dz-49c6f541-da8c-443e-8fbe-1682b9bb06b6-1	49c6f541-da8c-443e-8fbe-1682b9bb06b6	دبورية	15	\N	\N	\N	t	0
dz-49c6f541-da8c-443e-8fbe-1682b9bb06b6-2	49c6f541-da8c-443e-8fbe-1682b9bb06b6	الشبلي / أم الغنم	25	\N	\N	\N	t	1
dz-49c6f541-da8c-443e-8fbe-1682b9bb06b6-3	49c6f541-da8c-443e-8fbe-1682b9bb06b6	القرى الزعبية	40	\N	\N	\N	t	2
dz-49c6f541-da8c-443e-8fbe-1682b9bb06b6-4	49c6f541-da8c-443e-8fbe-1682b9bb06b6	إكسال	35	\N	\N	\N	t	3
dz-7321b5a1-7a85-4002-8ab6-71ff0431822e-1	7321b5a1-7a85-4002-8ab6-71ff0431822e	دبورية	15	\N	\N	\N	t	0
dz-7321b5a1-7a85-4002-8ab6-71ff0431822e-2	7321b5a1-7a85-4002-8ab6-71ff0431822e	الشبلي / أم الغنم	25	\N	\N	\N	t	1
dz-7321b5a1-7a85-4002-8ab6-71ff0431822e-3	7321b5a1-7a85-4002-8ab6-71ff0431822e	القرى الزعبية	40	\N	\N	\N	t	2
dz-7321b5a1-7a85-4002-8ab6-71ff0431822e-4	7321b5a1-7a85-4002-8ab6-71ff0431822e	إكسال	35	\N	\N	\N	t	3
dz-62af86ec-0ef7-42fb-b707-c197cab8d05c-1	62af86ec-0ef7-42fb-b707-c197cab8d05c	دبورية	15	\N	\N	\N	t	0
dz-62af86ec-0ef7-42fb-b707-c197cab8d05c-2	62af86ec-0ef7-42fb-b707-c197cab8d05c	الشبلي / أم الغنم	25	\N	\N	\N	t	1
dz-62af86ec-0ef7-42fb-b707-c197cab8d05c-3	62af86ec-0ef7-42fb-b707-c197cab8d05c	القرى الزعبية	40	\N	\N	\N	t	2
dz-62af86ec-0ef7-42fb-b707-c197cab8d05c-4	62af86ec-0ef7-42fb-b707-c197cab8d05c	إكسال	35	\N	\N	\N	t	3
dz-5b35539f-90e1-49cc-8c32-8d26cdce20f2-1	5b35539f-90e1-49cc-8c32-8d26cdce20f2	دبوريه 	15	0	\N	\N	t	0
f21c49cf-e585-4008-830f-ba07fc330d92	1cc59722-3687-45a1-9121-e7a608fba225	الشبلي/ام الغنم 	25	0	\N	\N	t	1
\.


--
-- Data for Name: Market; Type: TABLE DATA; Schema: public; Owner: nmd
--

COPY public."Market" (id, name, slug, branding, "isActive", "sortOrder", "paymentCapabilities", "imageUrl") FROM stdin;
market-dabburiyya	دبورية ماركت	dabburiyya	{"primaryColor":"#D97706"}	t	4	{"cash":true,"card":false}	https://nmd.marketing/api/uploads/1773154385148-ackrkgpz.webp
market-iksal	إكسال ماركت	iksal	{"primaryColor":"#353ca7"}	t	1	{"cash":true,"card":false}	https://nmd.marketing/api/uploads/1773154404101-s560v4su.webp
48fc79fc-c6ed-481a-b6cd-1dcdb6641a83	سوق الناصرة الرقمي	nazareth	{"primaryColor":"#c36c09"}	f	\N	{"cash":true,"card":false}	\N
\.


--
-- Data for Name: Order; Type: TABLE DATA; Schema: public; Owner: nmd
--

COPY public."Order" (id, "tenantId", "courierId", "marketId", status, "fulfillmentType", "orderType", total, "createdAt", payment, "deliveryTimeline", payload) FROM stdin;
a194e17e-8b39-4588-85bd-a448495f3f27	1cc59722-3687-45a1-9121-e7a608fba225	\N	market-dabburiyya	COMPLETED	DELIVERY	PRODUCT	75	2026-03-08T05:32:56.729Z	{"method":"CASH","provider":"NMD","status":"PENDING","currency":"ILS","breakdown":{"itemsTotal":60,"deliveryFee":15},"financials":{"gross":75,"commission":7.5,"gatewayFee":0,"netToMerchant":67.5,"netToMarket":7.5}}	\N	{"paymentMethod":"CASH","items":[{"productId":"c910f5d5-846b-4178-8a07-83ca1e51d096","productName":"بيتسا عائلية","categoryId":"15a1b5ad-bd38-4fb5-b948-7962f9755463","quantity":1,"basePrice":60,"selectedOptions":[{"optionGroupId":"ea13eb47-0d4c-442a-b16a-871d3d524abd","optionItemIds":["a73b444c-86f5-4e06-81f9-f1ff54771177","07ad62d3-28a4-482a-91f4-bcc52185d823"],"optionPlacements":{"a73b444c-86f5-4e06-81f9-f1ff54771177":"WHOLE","07ad62d3-28a4-482a-91f4-bcc52185d823":"RIGHT"},"sliceSelection":"WHOLE"}],"optionGroups":[{"id":"ea13eb47-0d4c-442a-b16a-871d3d524abd","name":"اضافاات","type":"CUSTOM","required":true,"minSelected":1,"maxSelected":1,"selectionType":"single","items":[{"id":"9097f4db-0221-4567-8483-7f3a2dd0cc08","name":"زيتون","sortOrder":0,"placement":"HALF"},{"id":"ec436bf9-cc19-466f-83d0-27c7845cabfd","name":"زيتون اسود","sortOrder":1,"placement":"HALF"},{"id":"aff00b65-0403-42eb-abcb-020be4d73771","name":"بصل","sortOrder":2,"placement":"HALF"},{"id":"ea8ca896-6b91-4911-936b-d441ea367be0","name":"ذرة","sortOrder":3,"placement":"HALF"},{"id":"17a0d6b3-2333-4a39-be7c-556cab25f203","name":"بندورة","sortOrder":4,"placement":"HALF"},{"id":"bf3f4f10-dfc2-4b9b-b6fb-ac142a7451d1","name":"فلفل حلو","sortOrder":5,"placement":"HALF"},{"id":"a73b444c-86f5-4e06-81f9-f1ff54771177","name":"فلفل حار","sortOrder":6,"placement":"HALF"},{"id":"6be8d1a3-4b6a-4ae9-8171-caaeeaa964db","name":"فطر","sortOrder":7,"placement":"HALF"},{"id":"f7b0f36c-6620-455d-a01d-282d144c0555","name":"تونة","sortOrder":8,"placement":"HALF"},{"id":"07ad62d3-28a4-482a-91f4-bcc52185d823","name":"ببروني","sortOrder":9,"placement":"HALF"},{"id":"4d511c25-9401-4c5e-90ed-41a7cd8ce232","name":"ثوم","sortOrder":10,"placement":"HALF"}],"allowHalfPlacement":true}],"totalPrice":60,"imageUrl":"https://nmd.marketing/api/uploads/1772734099290-bvnbofpp.webp","id":"446c4b03-0048-4b9f-8929-66951789d079"}],"subtotal":60,"currency":"ILS","customerName":"فواز عزايزة","customerPhone":"0546111668","deliveryAddress":"دبورية - تواصل معي بالواتساب لتحديد الموقع","delivery":{"method":"DELIVERY","zoneId":"e9cc9d8e-62db-4ca8-b2c9-2f932327686e","zoneName":"دبوريه ","fee":15,"addressText":"دبورية - تواصل معي بالواتساب لتحديد الموقع"},"orderGroupId":"0bfa6fed-07f5-4546-aa5b-fd6a9afd4c28","customerId":"customer-3bf4ba86-362f-43fd-aa0a-a89ba8c61f56","deliveryAssignmentMode":"MARKET","prepTimeMin":30,"readyAt":"2026-03-08T06:02:56.729Z","merchantAmount":60,"platformDeliveryFee":15,"fallbackTriggeredAt":"2026-03-08T08:06:41.040Z","lastStatusNotification":{"status":"COMPLETED","at":"2026-03-09T13:23:33.686Z"}}
e8190c54-f7e3-494e-b737-ee47edc43d49	1cc59722-3687-45a1-9121-e7a608fba225	\N	market-dabburiyya	COMPLETED	DELIVERY	PRODUCT	40	2026-03-09T13:21:11.345Z	{"method":"CASH","provider":"NMD","status":"PENDING","currency":"ILS","breakdown":{"itemsTotal":25,"deliveryFee":15},"financials":{"gross":40,"commission":4,"gatewayFee":0,"netToMerchant":36,"netToMarket":4}}	\N	{"paymentMethod":"CASH","items":[{"productId":"a47157a1-e091-4242-bbbd-5545d5e6ee50","productName":"بيتسا صغير","categoryId":"15a1b5ad-bd38-4fb5-b948-7962f9755463","quantity":1,"basePrice":25,"selectedOptions":[],"optionGroups":[{"id":"dc9108b1-95c5-4ea1-b0cb-6541a16fb88e","name":"اضافات","type":"CUSTOM","required":true,"minSelected":1,"maxSelected":1,"selectionType":"single","items":[]}],"totalPrice":25,"imageUrl":"https://nmd.marketing/api/uploads/1772734525734-bbtvv9l2.webp","id":"61ae4f44-2566-4cf3-b30d-442e7a193cee"}],"subtotal":25,"currency":"ILS","customerName":"فواز عزايزة","customerPhone":"0546111668","deliveryAddress":"دبورية - تواصل معي بالواتساب لتحديد الموقع","delivery":{"method":"DELIVERY","zoneId":"e9cc9d8e-62db-4ca8-b2c9-2f932327686e","zoneName":"دبوريه ","fee":15,"addressText":"دبورية - تواصل معي بالواتساب لتحديد الموقع"},"orderGroupId":"190d9996-0f7c-411d-9bcb-3cea43e91572","customerId":"customer-3bf4ba86-362f-43fd-aa0a-a89ba8c61f56","deliveryAssignmentMode":"MARKET","prepTimeMin":30,"readyAt":"2026-03-09T13:51:11.345Z","merchantAmount":25,"platformDeliveryFee":15,"lastStatusNotification":{"status":"COMPLETED","at":"2026-03-09T13:22:57.516Z"},"fallbackTriggeredAt":"2026-03-09T15:31:23.060Z"}
e6145f43-fe6d-44d7-8884-7dc2529ed757	2f663230-f9b3-463c-b8ab-eb55a5474b95	courier-50971b77-4811-49e8-825b-78bd84041782	market-dabburiyya	COMPLETED	DELIVERY	PRODUCT	50	2026-03-09T13:25:02.688Z	{"method":"CASH","provider":"NMD","status":"PENDING","currency":"ILS","breakdown":{"itemsTotal":35,"deliveryFee":15},"financials":{"gross":50,"commission":15,"gatewayFee":0,"netToMerchant":20,"netToMarket":30}}	{"assignedAt":"2026-03-09T13:25:41.430Z","acknowledgedAt":"2026-03-09T13:25:52.251Z","handedToDriverAt":"2026-03-09T13:25:53.585Z","pickedUpAt":"2026-03-09T13:25:59.721Z","deliveredAt":"2026-03-09T13:26:05.022Z","durations":{"totalMinutes":0,"assignedToAcknowledged":0,"acknowledgedToPickedUp":0,"pickedUpToDelivered":0}}	{"paymentMethod":"CASH","items":[{"productId":"2b6506cd-c054-43e6-a95b-68fb6e930e66","productName":"قشطوطة فواكه","categoryId":"3f72a4ff-f5e3-428a-adca-467321eb9e83","quantity":1,"basePrice":35,"selectedOptions":[],"optionGroups":[],"totalPrice":35,"imageUrl":"https://nmd.marketing/api/uploads/1772871630045-hfx4qz2n.webp","id":"bc72baca-9b28-4f6a-afd2-26d45533caef"}],"subtotal":35,"currency":"ILS","customerName":"فواز عزايزة","customerPhone":"0546111668","deliveryAddress":"دبورية - تواصل معي بالواتساب لتحديد الموقع","delivery":{"method":"DELIVERY","zoneId":"e88cad83-01ba-4614-a675-40da9244b1bf","zoneName":"دبوريه ","fee":15,"addressText":"دبورية - تواصل معي بالواتساب لتحديد الموقع"},"orderGroupId":"2c51dd03-e9ac-476b-94e5-daf7bef841d8","customerId":"customer-3bf4ba86-362f-43fd-aa0a-a89ba8c61f56","deliveryAssignmentMode":"MARKET","readyAt":"2026-03-09T13:25:02.688Z","merchantAmount":35,"platformDeliveryFee":15,"deliveryStatus":"DELIVERED","lastStatusNotification":{"status":"READY","at":"2026-03-09T13:25:49.274Z"},"deliveredAt":"2026-03-09T13:26:05.022Z","fallbackTriggeredAt":"2026-03-09T13:39:02.143Z"}
2b9d546f-3f12-4ffb-baa0-ae157c4dc3a5	f6e493da-e69f-4bbc-877b-8842a1dfb72e	\N	market-dabburiyya	COMPLETED	PICKUP	PRODUCT	35	2026-03-09T15:27:49.287Z	{"method":"CASH","provider":"NMD","status":"PENDING","currency":"ILS","breakdown":{"itemsTotal":35,"deliveryFee":5},"financials":{"gross":35,"commission":3.5,"gatewayFee":0,"netToMerchant":31.5,"netToMarket":3.5}}	\N	{"paymentMethod":"CASH","items":[{"productId":"1fa3216b-d811-4bae-a8ef-ddd7fd23c412","productName":"صفيحة لحمة","categoryId":"94f42e0b-25c3-406d-8a58-d02613b74358","quantity":1,"basePrice":35,"selectedOptions":[],"optionGroups":[],"totalPrice":35,"imageUrl":"https://nmd.marketing/api/uploads/1772759616200-uz2h5dno.webp","quantityStep":1,"unitName":"حبة","isWeightBased":false,"id":"149269b7-03bf-46f5-9480-78f22147bd58"}],"subtotal":35,"currency":"ILS","customerName":"فواز عزايزة","customerPhone":"0546111668","delivery":{"method":"PICKUP"},"orderGroupId":"538258f5-6d58-44c4-83ca-d7061c5a3749","customerId":"customer-3bf4ba86-362f-43fd-aa0a-a89ba8c61f56","merchantAmount":35,"platformDeliveryFee":5,"lastStatusNotification":{"status":"COMPLETED","at":"2026-03-09T15:32:01.730Z"}}
5050c45b-3596-420e-8776-e69686290722	f6e493da-e69f-4bbc-877b-8842a1dfb72e	\N	market-dabburiyya	COMPLETED	PICKUP	PRODUCT	35	2026-03-09T15:28:49.559Z	{"method":"CASH","provider":"NMD","status":"PENDING","currency":"ILS","breakdown":{"itemsTotal":35,"deliveryFee":5},"financials":{"gross":35,"commission":3.5,"gatewayFee":0,"netToMerchant":31.5,"netToMarket":3.5}}	\N	{"paymentMethod":"CASH","items":[{"productId":"1fa3216b-d811-4bae-a8ef-ddd7fd23c412","productName":"صفيحة لحمة","categoryId":"94f42e0b-25c3-406d-8a58-d02613b74358","quantity":1,"basePrice":35,"selectedOptions":[],"optionGroups":[],"totalPrice":35,"imageUrl":"https://nmd.marketing/api/uploads/1772759616200-uz2h5dno.webp","quantityStep":1,"unitName":"حبة","isWeightBased":false,"id":"b04c5f7f-b566-478a-87ad-8d54395101bd"}],"subtotal":35,"currency":"ILS","customerName":"فواز عزايزة","customerPhone":"0546111668","delivery":{"method":"PICKUP"},"orderGroupId":"03cd5d91-0f40-44a6-b9e5-19364206c366","customerId":"customer-3bf4ba86-362f-43fd-aa0a-a89ba8c61f56","merchantAmount":35,"platformDeliveryFee":5,"lastStatusNotification":{"status":"COMPLETED","at":"2026-03-09T15:31:58.039Z"}}
464b3bc4-f732-483f-b58d-7eb2fdac182c	2f663230-f9b3-463c-b8ab-eb55a5474b95	\N	market-dabburiyya	COMPLETED	PICKUP	PRODUCT	35	2026-03-09T15:29:31.831Z	{"method":"CASH","provider":"NMD","status":"PENDING","currency":"ILS","breakdown":{"itemsTotal":35,"deliveryFee":5},"financials":{"gross":35,"commission":15,"gatewayFee":0,"netToMerchant":15,"netToMarket":20}}	\N	{"paymentMethod":"CASH","items":[{"productId":"4c38c94e-0526-4b82-b127-23e2b8a627ad","productName":"قشطوطة","categoryId":"3f72a4ff-f5e3-428a-adca-467321eb9e83","quantity":1,"basePrice":35,"selectedOptions":[],"optionGroups":[],"totalPrice":35,"imageUrl":"https://nmd.marketing/api/uploads/1772871518669-085vcwqe.webp","quantityStep":1,"unitName":"حبة","isWeightBased":false,"id":"db0f513f-d28b-4fbc-93b6-83a043643e47"}],"subtotal":35,"currency":"ILS","customerName":"فواز عزايزة","customerPhone":"0546111668","delivery":{"method":"PICKUP"},"orderGroupId":"a8cccc32-671e-424c-8856-ab0f27dc2de7","customerId":"customer-3bf4ba86-362f-43fd-aa0a-a89ba8c61f56","merchantAmount":35,"platformDeliveryFee":5,"lastStatusNotification":{"status":"COMPLETED","at":"2026-03-09T15:32:16.572Z"}}
8143296c-f14a-46e3-bea4-cdb44840afdd	2f663230-f9b3-463c-b8ab-eb55a5474b95	\N	market-dabburiyya	COMPLETED	PICKUP	PRODUCT	35	2026-03-09T13:15:31.808Z	{"method":"CASH","provider":"NMD","status":"PENDING","currency":"ILS","breakdown":{"itemsTotal":35,"deliveryFee":5},"financials":{"gross":35,"commission":15,"gatewayFee":0,"netToMerchant":15,"netToMarket":20}}	\N	{"paymentMethod":"CASH","items":[{"productId":"4c38c94e-0526-4b82-b127-23e2b8a627ad","productName":"قشطوطة","categoryId":"3f72a4ff-f5e3-428a-adca-467321eb9e83","quantity":1,"basePrice":35,"selectedOptions":[],"optionGroups":[],"totalPrice":35,"imageUrl":"https://nmd.marketing/api/uploads/1772871518669-085vcwqe.webp","id":"515a42fc-fe9a-4403-a8ed-f3f9c9c63c25"}],"subtotal":35,"currency":"ILS","customerName":"فواز عزايزة","customerPhone":"0546111668","delivery":{"method":"PICKUP"},"orderGroupId":"e59d2038-1813-46de-89f1-eebcbdecf332","customerId":"customer-3bf4ba86-362f-43fd-aa0a-a89ba8c61f56","merchantAmount":35,"platformDeliveryFee":5,"lastStatusNotification":{"status":"COMPLETED","at":"2026-03-09T13:16:17.842Z"}}
1c7a4536-b9d7-49d2-a084-59c98325b530	1cc59722-3687-45a1-9121-e7a608fba225	courier-50971b77-4811-49e8-825b-78bd84041782	market-dabburiyya	COMPLETED	DELIVERY	PRODUCT	75	2026-03-09T13:19:44.978Z	{"method":"CASH","provider":"NMD","status":"PENDING","currency":"ILS","breakdown":{"itemsTotal":60,"deliveryFee":15},"financials":{"gross":75,"commission":7.5,"gatewayFee":0,"netToMerchant":67.5,"netToMarket":7.5}}	{"assignedAt":"2026-03-09T13:21:59.930Z","acknowledgedAt":"2026-03-09T13:22:47.927Z"}	{"paymentMethod":"CASH","items":[{"productId":"c910f5d5-846b-4178-8a07-83ca1e51d096","productName":"بيتسا عائلية","categoryId":"15a1b5ad-bd38-4fb5-b948-7962f9755463","quantity":1,"basePrice":60,"selectedOptions":[{"optionGroupId":"ea13eb47-0d4c-442a-b16a-871d3d524abd","optionItemIds":["ec436bf9-cc19-466f-83d0-27c7845cabfd","9097f4db-0221-4567-8483-7f3a2dd0cc08","bf3f4f10-dfc2-4b9b-b6fb-ac142a7451d1","aff00b65-0403-42eb-abcb-020be4d73771","f7b0f36c-6620-455d-a01d-282d144c0555"],"optionPlacements":{"ec436bf9-cc19-466f-83d0-27c7845cabfd":"WHOLE","9097f4db-0221-4567-8483-7f3a2dd0cc08":"WHOLE","bf3f4f10-dfc2-4b9b-b6fb-ac142a7451d1":"WHOLE","aff00b65-0403-42eb-abcb-020be4d73771":"WHOLE","f7b0f36c-6620-455d-a01d-282d144c0555":"WHOLE"},"sliceSelection":"WHOLE"}],"optionGroups":[{"id":"ea13eb47-0d4c-442a-b16a-871d3d524abd","name":"اضافاات","type":"CUSTOM","required":true,"minSelected":1,"maxSelected":1,"selectionType":"single","items":[{"id":"9097f4db-0221-4567-8483-7f3a2dd0cc08","name":"زيتون","sortOrder":0,"placement":"HALF"},{"id":"ec436bf9-cc19-466f-83d0-27c7845cabfd","name":"زيتون اسود","sortOrder":1,"placement":"HALF"},{"id":"aff00b65-0403-42eb-abcb-020be4d73771","name":"بصل","sortOrder":2,"placement":"HALF"},{"id":"ea8ca896-6b91-4911-936b-d441ea367be0","name":"ذرة","sortOrder":3,"placement":"HALF"},{"id":"17a0d6b3-2333-4a39-be7c-556cab25f203","name":"بندورة","sortOrder":4,"placement":"HALF"},{"id":"bf3f4f10-dfc2-4b9b-b6fb-ac142a7451d1","name":"فلفل حلو","sortOrder":5,"placement":"HALF"},{"id":"a73b444c-86f5-4e06-81f9-f1ff54771177","name":"فلفل حار","sortOrder":6,"placement":"HALF"},{"id":"6be8d1a3-4b6a-4ae9-8171-caaeeaa964db","name":"فطر","sortOrder":7,"placement":"HALF"},{"id":"f7b0f36c-6620-455d-a01d-282d144c0555","name":"تونة","sortOrder":8,"placement":"HALF"},{"id":"07ad62d3-28a4-482a-91f4-bcc52185d823","name":"ببروني","sortOrder":9,"placement":"HALF"},{"id":"4d511c25-9401-4c5e-90ed-41a7cd8ce232","name":"ثوم","sortOrder":10,"placement":"HALF"}],"allowHalfPlacement":true}],"totalPrice":60,"imageUrl":"https://nmd.marketing/api/uploads/1772734099290-bvnbofpp.webp","quantityStep":1,"unitName":"حبة","id":"422f236e-d963-4851-84b7-6da52cd85cb5"}],"subtotal":60,"currency":"ILS","customerName":"فواز عزايزة","customerPhone":"0546111668","deliveryAddress":"دبورية - تواصل معي بالواتساب لتحديد الموقع","delivery":{"method":"DELIVERY","zoneId":"e9cc9d8e-62db-4ca8-b2c9-2f932327686e","zoneName":"دبوريه ","fee":15,"addressText":"دبورية - تواصل معي بالواتساب لتحديد الموقع"},"orderGroupId":"97d294c9-e361-4dad-b698-9a40bb6454f8","customerId":"customer-3bf4ba86-362f-43fd-aa0a-a89ba8c61f56","deliveryAssignmentMode":"MARKET","prepTimeMin":30,"readyAt":"2026-03-09T13:49:44.978Z","merchantAmount":60,"platformDeliveryFee":15,"deliveryStatus":"IN_PROGRESS","lastStatusNotification":{"status":"COMPLETED","at":"2026-03-09T13:23:58.626Z"},"fallbackTriggeredAt":"2026-03-09T15:31:23.060Z"}
1fbe4fe6-e3d5-4657-a3c2-87f821370d66	2f663230-f9b3-463c-b8ab-eb55a5474b95	\N	market-dabburiyya	COMPLETED	PICKUP	PRODUCT	35	2026-03-09T15:30:50.524Z	{"method":"CASH","provider":"NMD","status":"PENDING","currency":"ILS","breakdown":{"itemsTotal":35,"deliveryFee":5},"financials":{"gross":35,"commission":15,"gatewayFee":0,"netToMerchant":15,"netToMarket":20}}	\N	{"paymentMethod":"CASH","items":[{"productId":"4c38c94e-0526-4b82-b127-23e2b8a627ad","productName":"قشطوطة","categoryId":"3f72a4ff-f5e3-428a-adca-467321eb9e83","quantity":1,"basePrice":35,"selectedOptions":[],"optionGroups":[],"totalPrice":35,"imageUrl":"https://nmd.marketing/api/uploads/1772871518669-085vcwqe.webp","quantityStep":1,"unitName":"حبة","isWeightBased":false,"id":"b2319be9-18ed-46d7-8472-08ae6b3e370b"}],"subtotal":35,"currency":"ILS","customerName":"فواز عزايزة","customerPhone":"0546111668","delivery":{"method":"PICKUP"},"orderGroupId":"fc58ab24-09e8-4b20-abb1-8ffbf9a493b9","customerId":"customer-3bf4ba86-362f-43fd-aa0a-a89ba8c61f56","merchantAmount":35,"platformDeliveryFee":5,"lastStatusNotification":{"status":"COMPLETED","at":"2026-03-09T15:32:15.770Z"}}
8622f214-4f72-4bbb-a086-2cbba685aa50	2f663230-f9b3-463c-b8ab-eb55a5474b95	\N	market-dabburiyya	PENDING	PICKUP	PRODUCT	35	2026-03-09T15:49:20.596Z	{"method":"CASH","provider":"NMD","status":"PENDING","currency":"ILS","breakdown":{"itemsTotal":35,"deliveryFee":5},"financials":{"gross":35,"commission":15,"gatewayFee":0,"netToMerchant":15,"netToMarket":20}}	\N	{"paymentMethod":"CASH","items":[{"productId":"2b6506cd-c054-43e6-a95b-68fb6e930e66","productName":"قشطوطة فواكه","categoryId":"3f72a4ff-f5e3-428a-adca-467321eb9e83","quantity":1,"basePrice":35,"selectedOptions":[],"optionGroups":[],"totalPrice":35,"imageUrl":"https://nmd.marketing/api/uploads/1772871630045-hfx4qz2n.webp","quantityStep":1,"unitName":"حبة","isWeightBased":false,"id":"2db3d804-0831-4da1-a0d0-697d8ccbe133"}],"subtotal":35,"currency":"ILS","customerName":"فواز عزايزة","customerPhone":"0546111668","delivery":{"method":"PICKUP"},"orderGroupId":"f669a890-cf15-4a9b-9c20-f67db8f2b781","customerId":"customer-3bf4ba86-362f-43fd-aa0a-a89ba8c61f56","merchantAmount":35,"platformDeliveryFee":5}
4127fa5f-fe2b-42d4-82a1-194cbbd6da5c	2f663230-f9b3-463c-b8ab-eb55a5474b95	courier-50971b77-4811-49e8-825b-78bd84041782	market-dabburiyya	PENDING	DELIVERY	PRODUCT	50	2026-03-09T15:49:35.098Z	{"method":"CASH","provider":"NMD","status":"PENDING","currency":"ILS","breakdown":{"itemsTotal":35,"deliveryFee":15},"financials":{"gross":50,"commission":15,"gatewayFee":0,"netToMerchant":20,"netToMarket":30}}	{"assignedAt":"2026-03-09T15:50:13.077Z","acknowledgedAt":"2026-03-09T15:50:20.382Z"}	{"paymentMethod":"CASH","items":[{"productId":"4c38c94e-0526-4b82-b127-23e2b8a627ad","productName":"قشطوطة","categoryId":"3f72a4ff-f5e3-428a-adca-467321eb9e83","quantity":1,"basePrice":35,"selectedOptions":[],"optionGroups":[],"totalPrice":35,"imageUrl":"https://nmd.marketing/api/uploads/1772871518669-085vcwqe.webp","quantityStep":1,"unitName":"حبة","isWeightBased":false,"id":"adfdfe91-426d-47d6-b381-e2eaf373e9b7"}],"subtotal":35,"currency":"ILS","customerName":"فواز عزايزة","customerPhone":"0546111668","deliveryAddress":"دبورية - تواصل معي بالواتساب لتحديد الموقع","delivery":{"method":"DELIVERY","zoneId":"e88cad83-01ba-4614-a675-40da9244b1bf","zoneName":"دبوريه ","fee":15,"addressText":"دبورية - تواصل معي بالواتساب لتحديد الموقع"},"orderGroupId":"48041742-9a6e-4b2b-8795-6dab6069032a","customerId":"customer-3bf4ba86-362f-43fd-aa0a-a89ba8c61f56","deliveryAssignmentMode":"MARKET","readyAt":"2026-03-09T15:49:35.098Z","merchantAmount":35,"platformDeliveryFee":15,"deliveryStatus":"IN_PROGRESS"}
a1a6784c-e8d1-4f6e-96e7-126ab0b8ca56	2f663230-f9b3-463c-b8ab-eb55a5474b95	\N	market-dabburiyya	PENDING	DELIVERY	PRODUCT	50	2026-03-09T15:51:06.983Z	{"method":"CASH","provider":"NMD","status":"PENDING","currency":"ILS","breakdown":{"itemsTotal":35,"deliveryFee":15},"financials":{"gross":50,"commission":15,"gatewayFee":0,"netToMerchant":20,"netToMarket":30}}	\N	{"paymentMethod":"CASH","items":[{"productId":"4c38c94e-0526-4b82-b127-23e2b8a627ad","productName":"قشطوطة","categoryId":"3f72a4ff-f5e3-428a-adca-467321eb9e83","quantity":1,"basePrice":35,"selectedOptions":[],"optionGroups":[],"totalPrice":35,"imageUrl":"https://nmd.marketing/api/uploads/1772871518669-085vcwqe.webp","quantityStep":1,"unitName":"حبة","isWeightBased":false,"id":"33d0ed66-2b4a-4a29-9d2a-df5c164a2297"}],"subtotal":35,"currency":"ILS","customerName":"فواز عزايزة","customerPhone":"0546111668","deliveryAddress":"دبورية - تواصل معي بالواتساب لتحديد الموقع","delivery":{"method":"DELIVERY","zoneId":"e88cad83-01ba-4614-a675-40da9244b1bf","zoneName":"دبوريه ","fee":15,"addressText":"دبورية - تواصل معي بالواتساب لتحديد الموقع"},"orderGroupId":"295abf14-74b2-45c0-8116-e4b074be2824","customerId":"customer-3bf4ba86-362f-43fd-aa0a-a89ba8c61f56","deliveryAssignmentMode":"MARKET","readyAt":"2026-03-09T15:51:06.983Z","merchantAmount":35,"platformDeliveryFee":15,"fallbackTriggeredAt":"2026-03-09T16:26:51.402Z"}
f9de98c8-28b0-4a91-8c12-8c3eeca50c0d	f6e493da-e69f-4bbc-877b-8842a1dfb72e	courier-50971b77-4811-49e8-825b-78bd84041782	market-dabburiyya	COMPLETED	DELIVERY	PRODUCT	50	2026-03-09T16:24:27.267Z	{"method":"CASH","provider":"NMD","status":"PENDING","currency":"ILS","breakdown":{"itemsTotal":35,"deliveryFee":15},"financials":{"gross":50,"commission":5,"gatewayFee":0,"netToMerchant":45,"netToMarket":5}}	{"assignedAt":"2026-03-09T16:52:51.313Z","handedToDriverAt":"2026-03-09T16:53:07.238Z","acknowledgedAt":"2026-03-09T16:53:17.875Z","pickedUpAt":"2026-03-09T16:53:19.190Z","deliveredAt":"2026-03-09T16:53:21.019Z","durations":{"totalMinutes":0,"assignedToAcknowledged":0,"acknowledgedToPickedUp":0,"pickedUpToDelivered":0}}	{"paymentMethod":"CASH","items":[{"productId":"1fa3216b-d811-4bae-a8ef-ddd7fd23c412","productName":"صفيحة لحمة","categoryId":"94f42e0b-25c3-406d-8a58-d02613b74358","quantity":1,"basePrice":35,"selectedOptions":[],"optionGroups":[],"totalPrice":35,"imageUrl":"https://nmd.marketing/api/uploads/1772759616200-uz2h5dno.webp","quantityStep":1,"unitName":"حبة","isWeightBased":false,"id":"a3a190f8-451b-4072-b2f0-b3d326f7a609"}],"subtotal":35,"currency":"ILS","customerName":"فواز عزايزة","customerPhone":"0546111668","deliveryAddress":"دبورية - تواصل معي بالواتساب لتحديد الموقع","delivery":{"method":"DELIVERY","zoneId":"c600b900-1a26-4c31-8f3d-0f9cdb19ab0f","zoneName":"دبوريه ","fee":15,"addressText":"دبورية - تواصل معي بالواتساب لتحديد الموقع"},"orderGroupId":"b0f9ab3a-eca2-4af0-9c5d-c87805494fa5","customerId":"customer-3bf4ba86-362f-43fd-aa0a-a89ba8c61f56","deliveryAssignmentMode":"MARKET","readyAt":"2026-03-09T16:24:27.267Z","merchantAmount":35,"platformDeliveryFee":15,"lastStatusNotification":{"status":"READY","at":"2026-03-09T16:29:16.917Z"},"deliveryStatus":"DELIVERED","deliveredAt":"2026-03-09T16:53:21.019Z"}
1267e025-418a-4226-a47a-ae4da557333d	6d59233f-5edd-463b-b379-2697e5b6df34	\N	market-dabburiyya	COMPLETED	PICKUP	PRODUCT	20	2026-03-09T21:58:43.398Z	{"method":"CASH","provider":"NMD","status":"PENDING","currency":"ILS","breakdown":{"itemsTotal":20,"deliveryFee":5},"financials":{"gross":20,"commission":2,"gatewayFee":0,"netToMerchant":18,"netToMarket":2}}	\N	{"paymentMethod":"CASH","items":[{"productId":"4e406eb4-05fd-4281-96bc-11443246f69c","productName":"صفيحة لحمة","categoryId":"fba36c55-c38e-451b-b73b-7ce91a3ba575","quantity":1,"basePrice":20,"selectedOptions":[],"optionGroups":[],"totalPrice":20,"imageUrl":"https://nmd.marketing/api/uploads/1772732742491-32fnt29n.webp","quantityStep":1,"unitName":"حبة","isWeightBased":false,"id":"5123e007-6e96-46b5-9404-9dd52b7b4f9b"}],"subtotal":20,"currency":"ILS","customerName":"فواز عزايزة","customerPhone":"0546111668","delivery":{"method":"PICKUP"},"orderGroupId":"2dfba27d-f800-4073-9519-64fbb59249e6","customerId":"customer-3bf4ba86-362f-43fd-aa0a-a89ba8c61f56","merchantAmount":20,"platformDeliveryFee":5,"lastStatusNotification":{"status":"COMPLETED","at":"2026-03-10T14:09:55.932Z"}}
c47d4901-0473-4469-9060-fb184bc9e691	6d59233f-5edd-463b-b379-2697e5b6df34	\N	market-dabburiyya	COMPLETED	DELIVERY	PRODUCT	35	2026-03-09T22:10:14.878Z	{"method":"CASH","provider":"NMD","status":"PENDING","currency":"ILS","breakdown":{"itemsTotal":20,"deliveryFee":15},"financials":{"gross":35,"commission":3.5,"gatewayFee":0,"netToMerchant":31.5,"netToMarket":3.5}}	\N	{"paymentMethod":"CASH","items":[{"productId":"4e406eb4-05fd-4281-96bc-11443246f69c","productName":"صفيحة لحمة","categoryId":"fba36c55-c38e-451b-b73b-7ce91a3ba575","quantity":1,"basePrice":20,"selectedOptions":[],"optionGroups":[],"totalPrice":20,"imageUrl":"https://nmd.marketing/api/uploads/1772732742491-32fnt29n.webp","quantityStep":1,"unitName":"حبة","isWeightBased":false,"id":"9355d31e-5a93-4885-abbf-cea4f0eea49c"}],"subtotal":20,"currency":"ILS","customerName":"فواز عزايزة","customerPhone":"0546111668","deliveryAddress":"دبورية - تواصل معي بالواتساب لتحديد الموقع","delivery":{"method":"DELIVERY","zoneId":"cf7ccc8d-46c6-4bd1-9a79-2184ab34e795","zoneName":"دبوريه ","fee":15,"addressText":"دبورية - تواصل معي بالواتساب لتحديد الموقع"},"orderGroupId":"98118044-67bb-4d87-83fb-61b6a7a0eaf9","customerId":"customer-3bf4ba86-362f-43fd-aa0a-a89ba8c61f56","deliveryAssignmentMode":"MARKET","prepTimeMin":30,"readyAt":"2026-03-09T22:40:14.878Z","merchantAmount":20,"platformDeliveryFee":15,"lastStatusNotification":{"status":"COMPLETED","at":"2026-03-10T14:09:59.447Z"}}
d08ece9a-f10f-47ea-9f53-5f66b27f76a8	f6e493da-e69f-4bbc-877b-8842a1dfb72e	\N	market-dabburiyya	COMPLETED	DELIVERY	PRODUCT	50	2026-03-09T22:21:51.509Z	{"method":"CASH","provider":"NMD","status":"PENDING","currency":"ILS","breakdown":{"itemsTotal":35,"deliveryFee":15},"financials":{"gross":50,"commission":5,"gatewayFee":0,"netToMerchant":45,"netToMarket":5}}	\N	{"paymentMethod":"CASH","items":[{"productId":"1fa3216b-d811-4bae-a8ef-ddd7fd23c412","productName":"صفيحة لحمة","categoryId":"94f42e0b-25c3-406d-8a58-d02613b74358","quantity":1,"basePrice":35,"selectedOptions":[],"optionGroups":[],"totalPrice":35,"imageUrl":"https://nmd.marketing/api/uploads/1772759616200-uz2h5dno.webp","quantityStep":1,"unitName":"حبة","isWeightBased":false,"id":"2ace6903-6aa6-4a97-992b-6499b0d90670"}],"subtotal":35,"currency":"ILS","customerName":"فواز عزايزة","customerPhone":"0546111668","deliveryAddress":"دبورية - تواصل معي بالواتساب لتحديد الموقع","delivery":{"method":"DELIVERY","zoneId":"c600b900-1a26-4c31-8f3d-0f9cdb19ab0f","zoneName":"دبوريه ","fee":15,"addressText":"دبورية - تواصل معي بالواتساب لتحديد الموقع"},"orderGroupId":"17aa60fb-6a99-49fc-a1c3-3c23bccee1e5","customerId":"customer-3bf4ba86-362f-43fd-aa0a-a89ba8c61f56","deliveryAssignmentMode":"MARKET","readyAt":"2026-03-09T22:21:51.509Z","merchantAmount":35,"platformDeliveryFee":15,"lastStatusNotification":{"status":"COMPLETED","at":"2026-03-09T22:23:07.829Z"}}
5f3d3839-bfca-4721-b989-67c4fc249d9f	f6e493da-e69f-4bbc-877b-8842a1dfb72e	\N	market-dabburiyya	COMPLETED	DELIVERY	PRODUCT	50	2026-03-09T22:22:44.389Z	{"method":"CASH","provider":"NMD","status":"PENDING","currency":"ILS","breakdown":{"itemsTotal":35,"deliveryFee":15},"financials":{"gross":50,"commission":5,"gatewayFee":0,"netToMerchant":45,"netToMarket":5}}	\N	{"paymentMethod":"CASH","items":[{"productId":"80b5f675-f851-49d1-9c87-ff66eef0c93d","productName":"صفيحة دجاج","categoryId":"94f42e0b-25c3-406d-8a58-d02613b74358","quantity":1,"basePrice":35,"selectedOptions":[],"optionGroups":[],"totalPrice":35,"imageUrl":"https://nmd.marketing/api/uploads/1772759638103-u5bz8v2p.webp","quantityStep":1,"unitName":"حبة","isWeightBased":false,"id":"5fd07b73-3fc2-4cac-bc34-e2a112c7df0f"}],"subtotal":35,"currency":"ILS","customerName":"فواز عزايزة","customerPhone":"0546111668","deliveryAddress":"دبورية - تواصل معي بالواتساب لتحديد الموقع","delivery":{"method":"DELIVERY","zoneId":"c600b900-1a26-4c31-8f3d-0f9cdb19ab0f","zoneName":"دبوريه ","fee":15,"addressText":"دبورية - تواصل معي بالواتساب لتحديد الموقع"},"orderGroupId":"dfa26d20-51f3-4b6d-aa25-a853731c913c","customerId":"customer-3bf4ba86-362f-43fd-aa0a-a89ba8c61f56","deliveryAssignmentMode":"MARKET","readyAt":"2026-03-09T22:22:44.389Z","merchantAmount":35,"platformDeliveryFee":15,"lastStatusNotification":{"status":"COMPLETED","at":"2026-03-09T22:23:10.592Z"}}
\.


--
-- Data for Name: Payment; Type: TABLE DATA; Schema: public; Owner: nmd
--

COPY public."Payment" (id, "orderId", method, status, amount, currency, provider, "providerRef", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Tenant; Type: TABLE DATA; Schema: public; Owner: nmd
--

COPY public."Tenant" (id, slug, name, "logoUrl", "primaryColor", "secondaryColor", "fontFamily", "radiusScale", "layoutStyle", enabled, "createdAt", "templateId", hero, banners, "whatsappPhone", type, "businessType", "marketCategory", "marketId", "isListedInMarket", "marketSortOrder", "tenantType", "deliveryProviderMode", "allowMarketCourierFallback", "defaultPrepTimeMin", "financialConfig", "paymentCapabilities", "operationalStatus", "orderPolicy", "businessHours", "busyBannerEnabled", "busyBannerText", "bookingEnabled", about, "officeHours", phone, "storeType", "appointmentDuration", collections, "openTime", "closeTime", "forceClosed", "deliveryRadiusKm", "addressLine", location, meta, "pillarId", "subCategoryId") FROM stdin;
62af86ec-0ef7-42fb-b707-c197cab8d05c	caramela-sandwitch	CARAMELA  SANDWITCH	https://nmd.marketing/api/uploads/1773140202940-v77yf8y4.webp	#dabf5d	#d4a574	"Cairo", system-ui, sans-serif	1	default	t	2026-03-10T10:54:41.457Z	\N	{"title":"CARAMELA  SANDWITCH","subtitle":"اكتشف أفضل المنتجات لدينا","imageUrl":"https://nmd.marketing/api/uploads/1773142162549-9dhe29vs.webp","ctaText":"تسوق الآن","ctaLink":"#","ctaHref":"#"}	[]	972545212230	FOOD	RESTAURANT	GENERAL	\N	t	\N	RESTAURANT	TENANT	t	30	{"commissionType":"PERCENTAGE","commissionValue":10,"deliveryFeeModel":"TENANT"}	{"cash":true,"card":false}	open	\N	\N	\N	\N	\N	\N	\N	972545212230	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pillar-food	df7c3653-e41d-4a36-820b-4d9614b4ba74
5b35539f-90e1-49cc-8c32-8d26cdce20f2	ms-brands	MS BRAND	https://nmd.marketing/api/uploads/1772759244008-w12dh3my.webp	#420f0c	#fcfcfc	"Cairo", system-ui, sans-serif	1	default	t	2026-02-13T09:43:17.616Z	\N	{"title":"MS BRAND","subtitle":"اكتشف أفضل المنتجات لدينا","imageUrl":"https://nmd.marketing/api/uploads/1772759254874-wb5btfh5.webp","ctaText":"تسوق الآن","ctaLink":"#","ctaHref":"#"}	[{"id":"060cee1a-b710-4a58-bc74-79f09c0fbe2d","imageUrl":"","enabled":true,"sortOrder":0,"title":"تخفيضات هائلة","ctaHref":"","link":""}]	972505595957	CLOTHING	RETAIL	816423cd-d95a-4018-91b8-be6adade85f9	market-dabburiyya	t	0	SHOP	MARKET	t	30	{"commissionType":"PERCENTAGE","commissionValue":10,"deliveryFeeModel":"TENANT"}	{"cash":true,"card":false}	open	accept_always	{"sun":{"open":"09:00","close":"00:00","isClosedDay":false},"mon":{"open":"09:00","close":"00:00","isClosedDay":false},"tue":{"open":"09:00","close":"00:00","isClosedDay":false},"wed":{"open":"09:00","close":"00:00","isClosedDay":false},"thu":{"open":"09:00","close":"00:00","isClosedDay":false},"fri":{"open":"09:00","close":"15:00","isClosedDay":true},"sat":{"open":"10:00","close":"00:00","isClosedDay":false}}	f	المحل مشغول حالياً، قد يستغرق الطلب وقتاً أطول	\N	\N	\N	972505595957	\N	\N	\N	00:00	23:59	f	\N	دبورية، شارع الرئيسي ١	{"lat":32.6903569,"lng":35.3706687}	\N	pillar-retail	b4b97518-ca7f-4dbd-a8ee-f72bef690df2
a7b8c9d0-e1f2-4a3b-8c9d-0e1f2a3b4c5d	lawyer-falan	مكتب المحامي نمر مصالحة	https://nmd.marketing/api/uploads/1772784889605-cmaiaj7d.webp	#000000	#ffffff	"Cairo", system-ui, sans-serif	1	default	t	2026-03-01T12:00:00.000Z	\N	{"title":"","subtitle":"","imageUrl":"https://nmd.marketing/api/uploads/1772966659747-7a0own93.webp","ctaText":"تواصل معنا","ctaLink":"#","ctaHref":"#"}	[]	972543345123	GENERAL	RETAIL	2add1d60-6585-4d7f-bebe-02edb2394446	market-dabburiyya	t	0	SHOP	TENANT	t	\N	{"commissionType":"PERCENTAGE","commissionValue":10,"deliveryFeeModel":"TENANT"}	{"cash":true,"card":false}	open	\N	\N	\N	\N	\N	\N	\N	972543345123	\N	\N	\N	00:00	23:59	f	\N	\N	\N	\N	pillar-services	69c35186-d594-48a2-99f8-00123a535de7
2f663230-f9b3-463c-b8ab-eb55a5474b95	store-1772815941301	قشطوطة	https://nmd.marketing/api/uploads/1772816838211-wvrnb48f.webp	#2e8fff	#ffffff	"Cairo", system-ui, sans-serif	1	default	t	2026-03-06T16:52:29.234Z	\N	{"title":"قشطوطة","subtitle":"","imageUrl":"https://nmd.marketing/api/uploads/1772816883883-vn2sa009.webp","ctaText":"تسوق الآن","ctaLink":"#","ctaHref":"#"}	[]	972502505230	GENERAL	RETAIL	d5716a93-00c8-4cd2-898f-1619f774f430	market-dabburiyya	t	0	SHOP	TENANT	t	30	{"commissionType":"FIXED","commissionValue":15,"deliveryFeeModel":"MARKET"}	{"cash":true,"card":false}	open	\N	\N	\N	\N	\N	\N	\N	972502505230	\N	\N	\N	\N	\N	f	\N	\N	{"lat":32.68792695970339,"lng":35.373514294624336}	\N	pillar-food	f9dc0162-4f7a-4981-95e4-35915770eb3c
default	default	المتجر الافتراضي		#000000	#ffffff	inherit	1	default	t	2026-03-10T12:09:28.723Z	\N	\N	\N	\N	\N	RETAIL	\N	\N	t	\N	\N	\N	\N	\N	\N	\N	open	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	\N	\N
3f801fb9-f6f9-4e81-b3a2-f8954498cdac	obr	OBR	https://nmd.marketing/api/uploads/1772759949280-kj9dr853.webp	#ff0066	#ffffff	"Cairo", system-ui, sans-serif	1	default	t	2026-02-13T18:37:54.524Z	\N	{"title":"OBR","subtitle":"","imageUrl":"https://nmd.marketing/api/uploads/1772759958471-5mvmjqis.webp","ctaText":"تسوق الآن","ctaLink":"#","ctaHref":"#"}	[]	972509528585	GENERAL	RETAIL	7666f69d-0986-48e5-8370-518c6477df1a	market-dabburiyya	t	0	SHOP	TENANT	t	\N	{"commissionType":"PERCENTAGE","commissionValue":10,"deliveryFeeModel":"TENANT"}	{"cash":true,"card":false}	open	\N	\N	\N	\N	\N	\N	\N	972509528585	\N	\N	\N	00:00	23:59	f	\N	دبورية، شارع التسوق	{"lat":32.6903525,"lng":35.3706903}	\N	pillar-retail	277d5a15-f7b3-4209-9cbf-573cc52047e0
1cc59722-3687-45a1-9121-e7a608fba225	بيتسا-اشرف	بيتسا اشرف	https://nmd.marketing/api/uploads/1772733865011-rys081tn.webp	#a70c0c	#0e0e0c	"Cairo", system-ui, sans-serif	1	default	t	2026-02-14T17:32:32.647Z	\N	{"title":"بيتسا اشرف","subtitle":"","imageUrl":"https://nmd.marketing/api/uploads/1772733910227-atrixwi1.webp","ctaText":"تسوق الآن","ctaLink":"#","ctaHref":"#"}	[]	972544482787	FOOD	RESTAURANT	eb1a697d-7f18-4fe6-a345-5204e6fadd4c	market-dabburiyya	t	0	RESTAURANT	TENANT	t	30	{"commissionType":"PERCENTAGE","commissionValue":10,"deliveryFeeModel":"TENANT"}	{"cash":true,"card":false}	open	\N	\N	\N	\N	\N	\N	\N	972544482787	\N	\N	\N	00:00	23:59	f	\N	دبورية، بيتسا اشرف	{"lat":32.6915,"lng":35.372}	\N	pillar-food	e4104697-25b8-4c78-b190-40c29ec4ba9a
1c6f3866-a475-445e-8806-42065adea654	مكتب-المحامي-يوسف-حسام-دراوشة	مكتب المحامي يوسف حسام دراوشة		#d7b96f	#222426	"Cairo", system-ui, sans-serif	1	default	t	2026-03-01T19:56:09.949Z	\N	{"title":"مكتب المحامي يوسف حسام دراوشة","subtitle":"اكتشف أفضل المنتجات لدينا","ctaText":"تسوق الآن","ctaLink":"#","ctaHref":"#"}	[]	\N	GENERAL	RETAIL	2add1d60-6585-4d7f-bebe-02edb2394446	market-iksal	t	0	SHOP	TENANT	t	\N	{"commissionType":"PERCENTAGE","commissionValue":10,"deliveryFeeModel":"TENANT"}	{"cash":true,"card":false}	open	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	00:00	23:59	f	\N	\N	\N	\N	\N	\N
6d59233f-5edd-463b-b379-2697e5b6df34	shaghaf	مخبز شغف	https://nmd.marketing/api/uploads/1772732667580-3p03z4qr.webp	#000000	#e2a765	"Cairo", system-ui, sans-serif	1	default	t	2026-03-04T18:56:08.819Z	\N	{"title":"مخبز شغف","subtitle":"اكتشف أفضل المنتجات لدينا","imageUrl":"https://nmd.marketing/api/uploads/1772732690692-wkjt2szy.webp","ctaText":"تسوق الآن","ctaLink":"#","ctaHref":"#"}	[]	972543500620	FOOD	RESTAURANT	de332be1-f8ce-41a9-b893-7aad317c487c	market-dabburiyya	t	0	RESTAURANT	TENANT	t	30	{"commissionType":"PERCENTAGE","commissionValue":10,"deliveryFeeModel":"TENANT"}	{"cash":true,"card":false}	open	\N	\N	\N	\N	\N	\N	\N	972543500620	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	6b796523-fd11-4224-9f76-2d7c82cabf8b	227cce06-6edc-43f6-ae28-a87a964612dc
0e742787-cd4f-4439-ac4f-3ec944ba7de0	jamal-az	עזאיזה ג'מאל מתכנן פיננסי ופנסיוני	https://nmd.marketing/api/uploads/1772965858296-dtm70ayf.webp	#c3a32c	#d4a574	"Cairo", system-ui, sans-serif	1	default	t	2026-03-08T10:27:44.156Z	\N	{"title":"","subtitle":"","imageUrl":"https://nmd.marketing/api/uploads/1772966190687-u3j10q3t.webp","ctaText":"تسوق الآن","ctaLink":"#","ctaHref":"#"}	[]	972545879084	GENERAL	RETAIL	GENERAL	market-dabburiyya	t	\N	SHOP	TENANT	t	\N	{"commissionType":"PERCENTAGE","commissionValue":10,"deliveryFeeModel":"TENANT"}	{"cash":true,"card":false}	open	\N	\N	\N	\N	\N	\N	\N	972545879084	\N	\N	\N	08:00	17:00	f	\N	\N	\N	\N	pillar-services	1f7e0f84-20f6-457b-b58c-4ba4ba7c4818
e4704bdc-a7ee-414a-8eb1-3663e4a40fa9	lava-cafe	lava cafe	https://nmd.marketing/api/uploads/1773058208826-4pfc0l3z.webp	#0a3d2c	#d4a574	"Cairo", system-ui, sans-serif	1	default	t	2026-03-09T11:46:15.594Z	\N	{"title":"lava cafe","subtitle":"اكتشف أفضل المنتجات لدينا","imageUrl":"https://nmd.marketing/api/uploads/1773058217184-1hsnc1w2.webp","ctaText":"تسوق الآن","ctaLink":"#","ctaHref":"#"}	[]	972587416664	GENERAL	RETAIL	GENERAL	market-dabburiyya	t	0	SHOP	TENANT	t	\N	{"commissionType":"PERCENTAGE","commissionValue":10,"deliveryFeeModel":"TENANT"}	{"cash":true,"card":false}	open	\N	\N	\N	\N	\N	\N	\N	972587416664	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pillar-food	f9dc0162-4f7a-4981-95e4-35915770eb3c
3eb37051-3217-489f-a471-5927cab34b0d	sala-market	sala market	https://nmd.marketing/api/uploads/1773058662393-2e6g3yxw.webp	#0f1010	#ffffff	"Cairo", system-ui, sans-serif	1	default	t	2026-03-09T12:16:27.451Z	\N	{"title":"sala market","subtitle":"اكتشف أفضل المنتجات لدينا","ctaText":"تسوق الآن","ctaLink":"#","ctaHref":"#"}	[]	972546111666	GENERAL	RETAIL	GENERAL	market-dabburiyya	t	\N	SHOP	TENANT	t	\N	{"commissionType":"PERCENTAGE","commissionValue":10,"deliveryFeeModel":"TENANT"}	{"cash":true,"card":false}	open	\N	\N	\N	\N	\N	\N	\N	972546111666	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	6b796523-fd11-4224-9f76-2d7c82cabf8b	84d0fb23-5c92-4c53-bc0e-2eb4894415d4
49c6f541-da8c-443e-8fbe-1682b9bb06b6	panda-coffe	panda coffe	https://nmd.marketing/api/uploads/1773059141330-uax84oya.webp	#b80000	#d4a574	"Cairo", system-ui, sans-serif	1	default	t	2026-03-09T12:25:13.767Z	\N	{"title":"panda coffe","subtitle":"اكتشف أفضل المنتجات لدينا","ctaText":"تسوق الآن","ctaLink":"#","ctaHref":"#"}	[]	972503333565	FOOD	RESTAURANT	GENERAL	market-dabburiyya	t	\N	RESTAURANT	MARKET	t	30	{"commissionType":"PERCENTAGE","commissionValue":10,"deliveryFeeModel":"TENANT"}	{"cash":true,"card":false}	open	\N	\N	\N	\N	\N	\N	\N	972503333565	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pillar-food	f9dc0162-4f7a-4981-95e4-35915770eb3c
7321b5a1-7a85-4002-8ab6-71ff0431822e	blue-bar	blue bar	https://nmd.marketing/api/uploads/1773059291897-s0ih9nev.webp	#002f9e	#f5f0ea	"Cairo", system-ui, sans-serif	1	default	t	2026-03-09T12:27:37.165Z	\N	{"title":"blue bar","subtitle":"اكتشف أفضل المنتجات لدينا","imageUrl":"https://nmd.marketing/api/uploads/1773059311585-b2isekux.webp","ctaText":"تسوق الآن","ctaLink":"#","ctaHref":"#"}	[]	972503667011	GENERAL	RETAIL	GENERAL	market-dabburiyya	t	\N	SHOP	TENANT	t	\N	{"commissionType":"PERCENTAGE","commissionValue":10,"deliveryFeeModel":"TENANT"}	{"cash":true,"card":false}	open	\N	\N	\N	\N	\N	\N	\N	972503667011	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pillar-food	f9dc0162-4f7a-4981-95e4-35915770eb3c
f741d517-e7e6-48c9-a046-18d85acf1d25	سوق-طلعت-للخضار-والفوكه	سوق طلعت للخضار والفوكه		#164541	#b5aea6	"Cairo", system-ui, sans-serif	1	default	t	2026-02-13T18:36:32.188Z	\N	{"title":"مرحباً بك","subtitle":"اكتشف أحدث صيحات الموضة","ctaText":"تسوق الآن","ctaLink":"#","ctaHref":"#"}	[{"id":"f0c26518-22a2-4a3d-a335-248d6c2c188e","imageUrl":"","title":"عرض خاص","subtitle":"خصومات حتى 30%","ctaText":"تسوقي الآن","ctaHref":"#","enabled":true,"sortOrder":0},{"id":"3d85739e-84bf-4892-a2de-f7c6b3dbcd63","imageUrl":"","title":"عرض محدود","subtitle":"ينتهي قريباً","ctaText":"اكتشفي","ctaHref":"#","enabled":true,"sortOrder":1,"expiresAt":"2026-02-20T18:28:05.603Z","showCountdown":true},{"id":"31b28df7-41ee-40d5-86b5-46b2c8c74395","imageUrl":"","title":"وصل حديثاً","subtitle":"موديلات جديدة","ctaText":"عرض الكل","ctaHref":"#","enabled":true,"sortOrder":2}]	\N	GENERAL	RETAIL	f6fef384-0681-4df7-9f07-ec579f4058a1	market-dabburiyya	f	0	SHOP	TENANT	t	\N	{"commissionType":"PERCENTAGE","commissionValue":10,"deliveryFeeModel":"TENANT"}	{"cash":true,"card":false}	open	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	00:00	23:59	f	\N	دبورية، سوق الخضار	{"lat":32.693,"lng":35.37}	\N	6b796523-fd11-4224-9f76-2d7c82cabf8b	bed3ad1e-a537-4eb5-880b-cd961ef43133
60904bcc-970a-45e3-8669-8015ee2afe64	توب-ماركت	توب ماركت		#010404	#cec0b1	"Cairo", system-ui, sans-serif	1	default	t	2026-02-14T17:35:27.948Z	\N	{"title":"مرحباً بك","subtitle":"اكتشف أحدث صيحات الموضة","ctaText":"تسوق الآن","ctaLink":"#","ctaHref":"#"}	[{"id":"74ff4fcb-0e28-43b4-bb12-b143f236aa04","imageUrl":"","title":"عرض خاص","subtitle":"خصومات حتى 30%","ctaText":"تسوقي الآن","ctaHref":"#","enabled":true,"sortOrder":0},{"id":"47e3bf44-03be-436f-80f5-2d3048e92413","imageUrl":"","title":"عرض محدود","subtitle":"ينتهي قريباً","ctaText":"اكتشفي","ctaHref":"#","enabled":true,"sortOrder":1,"expiresAt":"2026-02-21T17:34:49.776Z","showCountdown":true},{"id":"b6436add-0828-4157-ab1b-6e1da2e05002","imageUrl":"","title":"وصل حديثاً","subtitle":"موديلات جديدة","ctaText":"عرض الكل","ctaHref":"#","enabled":true,"sortOrder":2}]	\N	GENERAL	RETAIL	060538fe-a5b5-44d2-9766-9a6d5e0cf787	market-dabburiyya	f	0	SHOP	TENANT	t	\N	{"commissionType":"PERCENTAGE","commissionValue":10,"deliveryFeeModel":"TENANT"}	{"cash":true,"card":false}	open	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	00:00	23:59	f	\N	دبورية، توب ماركت	{"lat":32.6922,"lng":35.3715}	\N	6b796523-fd11-4224-9f76-2d7c82cabf8b	84d0fb23-5c92-4c53-bc0e-2eb4894415d4
0c36235a-9473-4226-b091-71e3fb0efdc5	rianbow-land	Rianbow Land	https://nmd.marketing/api/uploads/1772742013120-dnvfjiq0.webp	#4cbdb4	#fcfaf7	"Cairo", system-ui, sans-serif	1	default	t	2026-03-05T20:19:00.192Z	\N	{"title":"Rianbow Land","subtitle":"اكتشف أفضل المنتجات لدينا","imageUrl":"https://nmd.marketing/api/uploads/1772742020576-shtbzjph.webp","ctaText":"تسوق الآن","ctaLink":"#","ctaHref":"#"}	[]	9720508894749	GENERAL	RETAIL	060538fe-a5b5-44d2-9766-9a6d5e0cf787	market-dabburiyya	t	0	SHOP	TENANT	t	\N	{"commissionType":"PERCENTAGE","commissionValue":10,"deliveryFeeModel":"TENANT"}	{"cash":true,"card":false}	open	\N	\N	\N	\N	\N	\N	\N	9720508894749	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	6b796523-fd11-4224-9f76-2d7c82cabf8b	84d0fb23-5c92-4c53-bc0e-2eb4894415d4
f6e493da-e69f-4bbc-877b-8842a1dfb72e	buffalo-28	BUFFALO28	https://nmd.marketing/api/uploads/1772759532147-4pq6ojaa.webp	#f8bc3a	#fa0000	"Cairo", system-ui, sans-serif	1	default	t	2026-03-06T01:10:50.225Z	\N	{"title":"BUFFALO28","subtitle":"","imageUrl":"https://nmd.marketing/api/uploads/1772759573238-wcjblv8i.webp","ctaText":"تسوق الآن","ctaLink":"#","ctaHref":"#"}	[]	\N	GENERAL	RETAIL	eb1a697d-7f18-4fe6-a345-5204e6fadd4c	market-dabburiyya	t	0	SHOP	TENANT	t	\N	{"commissionType":"PERCENTAGE","commissionValue":10,"deliveryFeeModel":"TENANT"}	{"cash":true,"card":false}	open	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pillar-food	e4104697-25b8-4c78-b190-40c29ec4ba9a
b48b688d-fb40-4dd8-86da-b3d34dd1fffc	hamodi-flowers	Hamodi flowers	https://nmd.marketing/api/uploads/1772815552538-eoyo6rzk.webp	#f0d681	#d4a574	"Cairo", system-ui, sans-serif	1	default	t	2026-03-06T16:40:54.459Z	\N	{"title":"Hamodi flowers","subtitle":"","imageUrl":"https://nmd.marketing/api/uploads/1772815586132-b6531rgo.webp","ctaText":"تسوق الآن","ctaLink":"#","ctaHref":"#"}	[]	972527282742	GENERAL	RETAIL	GENERAL	market-dabburiyya	t	\N	SHOP	TENANT	t	\N	{"commissionType":"PERCENTAGE","commissionValue":10,"deliveryFeeModel":"TENANT"}	{"cash":true,"card":false}	open	\N	\N	\N	\N	\N	\N	\N	972527282742	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pillar-retail	33e76a89-d157-4de7-a70f-ede36636ad6f
bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	caramela-coffe	CARAMELA COFFE	https://nmd.marketing/api/uploads/1773058464831-yqetj9er.webp	#d7b484	#f0f0f0	"Cairo", system-ui, sans-serif	1	default	t	2026-03-09T12:05:23.016Z	\N	{"title":"CARAMELA COFFE","subtitle":"اكتشف أفضل المنتجات لدينا","imageUrl":"https://nmd.marketing/api/uploads/1773142029701-9h7sfpn8.webp","ctaText":"تسوق الآن","ctaLink":"#","ctaHref":"#"}	[]	972545212230	FOOD	RESTAURANT	d5716a93-00c8-4cd2-898f-1619f774f430	market-dabburiyya	t	0	RESTAURANT	TENANT	t	30	{"commissionType":"PERCENTAGE","commissionValue":10,"deliveryFeeModel":"TENANT"}	{"cash":true,"card":false}	busy	\N	\N	\N	\N	\N	\N	\N	972545212230	\N	\N	\N	\N	\N	f	\N	\N	\N	\N	pillar-food	f9dc0162-4f7a-4981-95e4-35915770eb3c
\.


--
-- Data for Name: TenantDeliverySettings; Type: TABLE DATA; Schema: public; Owner: nmd
--

COPY public."TenantDeliverySettings" ("tenantId", modes, "minimumOrder", "deliveryFee", payload) FROM stdin;
default	{"pickup":true,"delivery":true}	0	0	\N
62af86ec-0ef7-42fb-b707-c197cab8d05c	{"pickup":true,"delivery":true}	0	5	{"tenantId":"62af86ec-0ef7-42fb-b707-c197cab8d05c","zones":[]}
3eb37051-3217-489f-a471-5927cab34b0d	{"pickup":true,"delivery":true}	0	5	{"tenantId":"3eb37051-3217-489f-a471-5927cab34b0d","zones":[]}
7321b5a1-7a85-4002-8ab6-71ff0431822e	{"pickup":true,"delivery":true}	0	5	{"tenantId":"7321b5a1-7a85-4002-8ab6-71ff0431822e","zones":[]}
5b35539f-90e1-49cc-8c32-8d26cdce20f2	{"pickup":true,"delivery":true}	0	5	{"zones":[]}
f741d517-e7e6-48c9-a046-18d85acf1d25	{"pickup":true,"delivery":true}	0	5	{"zones":[]}
3f801fb9-f6f9-4e81-b3a2-f8954498cdac	{"pickup":true,"delivery":true}	0	5	{"zones":[]}
1cc59722-3687-45a1-9121-e7a608fba225	{"pickup":true,"delivery":true}	0	5	{"zones":[]}
60904bcc-970a-45e3-8669-8015ee2afe64	{"pickup":true,"delivery":true}	0	5	{"zones":[]}
6d59233f-5edd-463b-b379-2697e5b6df34	{"pickup":true,"delivery":true}	0	5	{"tenantId":"6d59233f-5edd-463b-b379-2697e5b6df34","zones":[]}
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: nmd
--

COPY public."User" (id, email, role, "marketId", "tenantId", "courierId", password, "mustChangePassword") FROM stdin;
user-tenant-ms-brands	ms-brands@nmd.com	TENANT_ADMIN	\N	5b35539f-90e1-49cc-8c32-8d26cdce20f2	\N	ms123456	f
user-tenant-obr	obr@nmd.com	TENANT_ADMIN	\N	3f801fb9-f6f9-4e81-b3a2-f8954498cdac	\N	obr123456	f
2ede51a0-749d-45bd-8451-3166096d57f2	talaat@nmd.com	TENANT_ADMIN	\N	f741d517-e7e6-48c9-a046-18d85acf1d25	\N	123456789	\N
d62665b1-8bf7-48cc-a71a-873341e5c4c0	shaghaf@nmd.com	TENANT_ADMIN	\N	6d59233f-5edd-463b-b379-2697e5b6df34	\N	sh123456	f
c044bd5d-ef9a-40e9-8ac5-18a89b69b43f	rianbowland@nmd.com	TENANT_ADMIN	\N	0c36235a-9473-4226-b091-71e3fb0efdc5	\N	rl123456	f
42a96df4-eb94-43f9-a479-2b29901e753a	buffalo28@nmd.com	TENANT_ADMIN	\N	f6e493da-e69f-4bbc-877b-8842a1dfb72e	\N	bf123456	\N
b189150c-2525-4794-8dbf-ea78d1b9bdd7	hflowers@nmd.com	TENANT_ADMIN	\N	b48b688d-fb40-4dd8-86da-b3d34dd1fffc	\N	hf123456	\N
adaad583-742a-491e-8f74-a21975a8c780	kshtota@nmd.com	TENANT_ADMIN	\N	2f663230-f9b3-463c-b8ab-eb55a5474b95	\N	ks123456	\N
ec0b7fe9-522f-4d70-a876-3835bbbc610c	jamal@nmd.com	TENANT_ADMIN	\N	0e742787-cd4f-4439-ac4f-3ec944ba7de0	\N	jm123456	\N
008de27f-9911-449d-a5b3-f0e6f97bff29	lavacafe@nmd.vom	TENANT_ADMIN	\N	e4704bdc-a7ee-414a-8eb1-3663e4a40fa9	\N	lava123456	f
9fc1f7e6-bc86-4433-a0cd-82803cbde294	caramela@nmd.com	TENANT_ADMIN	\N	bb3c5210-7dfc-46ee-a54a-7771ad32ee2a	\N	cm123456	\N
97c5ce06-0ac2-4a6b-b614-7d6e27c17211	sala@nmd.com	TENANT_ADMIN	\N	3eb37051-3217-489f-a471-5927cab34b0d	\N	sala123456	\N
4763e05a-906c-4d32-b475-e0b52a0454b2	panda@nmd.com	TENANT_ADMIN	\N	49c6f541-da8c-443e-8fbe-1682b9bb06b6	\N	panda123456	\N
adc69f42-b7ff-4146-92d5-4ad04f21a845	bluebar@nmd.com	TENANT_ADMIN	\N	7321b5a1-7a85-4002-8ab6-71ff0431822e	\N	blue123456	\N
2b67d0a8-1c55-4514-ac72-2e49d5be0057	carmelas@nmd.com	TENANT_ADMIN	\N	62af86ec-0ef7-42fb-b707-c197cab8d05c	\N	cms123456	\N
user-tenant-top-market	top-market@nmd.com	TENANT_ADMIN	\N	60904bcc-970a-45e3-8669-8015ee2afe64	\N	top-market@2026	\N
user-tenant-lawyer-falan	lawyer@nmd.com	TENANT_ADMIN	\N	a7b8c9d0-e1f2-4a3b-8c9d-0e1f2a3b4c5d	\N	123456	\N
user-courier-dab-1	ahmed@courier.nmd.com	COURIER	market-dabburiyya	\N	courier-50971b77-4811-49e8-825b-78bd84041782	123456	\N
user-courier-iksal-1	courier@iksal.nmd.com	COURIER	market-iksal	\N	courier-iksal-001	123456	\N
8c6511cd-7217-4a98-b533-e120e2184871	drawshe@nmd.com	TENANT_ADMIN	\N	1c6f3866-a475-445e-8806-42065adea654	\N	123456789	\N
bb20b202-8060-48e6-bb9f-dab5f7de84a1	pizzaashrf@nmd.com	TENANT_ADMIN	\N	1cc59722-3687-45a1-9121-e7a608fba225	\N	pa123456	f
user-root-admin	root@nmd.com	ROOT_ADMIN	\N	\N	\N	123456	\N
user-dab-admin	dab@nmd.com	MARKET_ADMIN	market-dabburiyya	\N	\N	123456	t
user-iks-admin	iksal@nmd.com	MARKET_ADMIN	market-iksal	\N	\N	123456	t
user-buffalo-admin	buffalo@admin.com	TENANT_ADMIN	\N	78463821-ccb7-48af-841b-84a18c42abb6	\N	123456	\N
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: nmd
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
16a03897-3691-413a-ad4f-e4350487f9a1	00d11740f19d65a653365c7c714ad44bfb957b061143a4896ce6567d163507ce	2026-03-10 12:08:03.664355+00	20260301120000_init_postgres	\N	\N	2026-03-10 12:08:03.51334+00	1
357c54d4-dd71-41e0-b013-1705df87a1c7	553354954f71dcc5a4e4caec20dd002feb39563d9e23c3e410ae43deead002de	2026-03-10 12:08:03.674429+00	20260301130000_tenant_operational_settings	\N	\N	2026-03-10 12:08:03.666614+00	1
0548b9c8-6a8b-4fcb-b6e5-d5c8fb2f625e	6247d94b955e451ce6092c9d076e6c80feb26c6512d3a14b67f9f33fedfbf9ce	2026-03-10 12:08:03.683119+00	20260301140000_tenant_collections	\N	\N	2026-03-10 12:08:03.677362+00	1
cfa8c4b5-b95a-49e5-ab09-9288c1482da7	cc0f3bb9d9f96d9ea99eba33b416b30dc2a7feb81c3db4dcd3a3a8555c63f64c	2026-03-10 12:08:03.691866+00	20260301150000_add_tenant_open_close_force_closed	\N	\N	2026-03-10 12:08:03.68592+00	1
8b3e51e9-365b-45a1-8dad-962a82fe9858	3fe6b790833266ac52c674fa345ac0215500c3c417f409b86dbd8796a921af9b	2026-03-10 12:08:03.699602+00	20260304120000_add_product_archived_sort_order	\N	\N	2026-03-10 12:08:03.694178+00	1
0b05734f-5c62-44ed-ad00-6b99ca797189	6e40914276ca55bdad14d0f776ca4a457df1026e657b53d3a22b691ffbe06ab9	2026-03-10 12:08:03.704476+00	20260307120000_tenant_delivery_radius_km	\N	\N	2026-03-10 12:08:03.701245+00	1
6a1d5ab4-43c6-41e6-95a1-3e2dd789b997	46084569e20b7354d34018a13e50cfcf6d8b4216462a66982a0d81010c84d55e	2026-03-10 14:04:30.031991+00	20260308120000_tenant_address_location_meta	\N	\N	2026-03-10 14:04:30.020655+00	1
1fb11d47-4f9e-4364-ad25-c22e3be4e096	cd990af79b2b39f8d87228ee4b6fd585c1aa381f057918239dd8cbb1e2caab7f	2026-03-10 14:04:30.037169+00	20260309120000_tenant_pillar_subcategory	\N	\N	2026-03-10 14:04:30.032825+00	1
f326ccee-a26c-44e3-b8f7-94ef55e0e74d	0397a0c91a9fb62aca71b97e9d6af090e0005395fb0d0b6c3e9ae40205c29e6b	2026-03-10 14:04:30.08403+00	20260310120000_contest_and_participation	\N	\N	2026-03-10 14:04:30.038327+00	1
a8bc1c47-2989-4d4c-b964-dc652c956635	f79ac66b36deca9904c06416059dcb71dc30cd3a11037fb0739ef0d18f64ac4a	2026-03-10 14:39:22.669962+00	20260311120000_market_image_url	\N	\N	2026-03-10 14:39:22.660871+00	1
9a7adabe-616f-4c9e-bb43-2e89ec38e75d	7802ff8b2bb230bb0ba354a9a60f4d2d62fd857ef6f20204423596e6b1fa54da	2026-03-10 14:39:22.676629+00	20260312120000_contest_banner_image	\N	\N	2026-03-10 14:39:22.671404+00	1
bbbde6ae-d38f-4686-9396-15921e6a61ac	438991cc5731e4784c48ccf7184204e639c5fd91096830d6186eebf7b65324fa	2026-03-10 15:17:05.550387+00	20260313000000_contest_match_prediction	\N	\N	2026-03-10 15:17:05.540011+00	1
6580c3ef-d475-438e-8aa1-3e54eb976709	5ef8f0d6ceb0120d9f70421c6b5bf255a959fdb1c403bb4c72d1998c273f5ec6	2026-03-10 15:17:05.56171+00	20260313120000_contest_is_prediction_scores	\N	\N	2026-03-10 15:17:05.552664+00	1
\.


--
-- Data for Name: whatsapp_logs; Type: TABLE DATA; Schema: public; Owner: nmd
--

COPY public.whatsapp_logs (id, phone, status, created_at) FROM stdin;
1	0546111668	success	2026-03-10 15:31:41.595869+00
2	0546111668	success	2026-03-10 15:43:53.664578+00
\.


--
-- Name: whatsapp_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: nmd
--

SELECT pg_catalog.setval('public.whatsapp_logs_id_seq', 2, true);


--
-- Name: CatalogCategory CatalogCategory_pkey; Type: CONSTRAINT; Schema: public; Owner: nmd
--

ALTER TABLE ONLY public."CatalogCategory"
    ADD CONSTRAINT "CatalogCategory_pkey" PRIMARY KEY (id);


--
-- Name: CatalogOptionGroup CatalogOptionGroup_pkey; Type: CONSTRAINT; Schema: public; Owner: nmd
--

ALTER TABLE ONLY public."CatalogOptionGroup"
    ADD CONSTRAINT "CatalogOptionGroup_pkey" PRIMARY KEY (id);


--
-- Name: CatalogProduct CatalogProduct_pkey; Type: CONSTRAINT; Schema: public; Owner: nmd
--

ALTER TABLE ONLY public."CatalogProduct"
    ADD CONSTRAINT "CatalogProduct_pkey" PRIMARY KEY (id);


--
-- Name: ContestParticipation ContestParticipation_pkey; Type: CONSTRAINT; Schema: public; Owner: nmd
--

ALTER TABLE ONLY public."ContestParticipation"
    ADD CONSTRAINT "ContestParticipation_pkey" PRIMARY KEY (id);


--
-- Name: Contest Contest_pkey; Type: CONSTRAINT; Schema: public; Owner: nmd
--

ALTER TABLE ONLY public."Contest"
    ADD CONSTRAINT "Contest_pkey" PRIMARY KEY (id);


--
-- Name: Courier Courier_pkey; Type: CONSTRAINT; Schema: public; Owner: nmd
--

ALTER TABLE ONLY public."Courier"
    ADD CONSTRAINT "Courier_pkey" PRIMARY KEY (id);


--
-- Name: Customer Customer_pkey; Type: CONSTRAINT; Schema: public; Owner: nmd
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_pkey" PRIMARY KEY (id);


--
-- Name: DeliveryZone DeliveryZone_pkey; Type: CONSTRAINT; Schema: public; Owner: nmd
--

ALTER TABLE ONLY public."DeliveryZone"
    ADD CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY (id);


--
-- Name: Market Market_pkey; Type: CONSTRAINT; Schema: public; Owner: nmd
--

ALTER TABLE ONLY public."Market"
    ADD CONSTRAINT "Market_pkey" PRIMARY KEY (id);


--
-- Name: Order Order_pkey; Type: CONSTRAINT; Schema: public; Owner: nmd
--

ALTER TABLE ONLY public."Order"
    ADD CONSTRAINT "Order_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: nmd
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: TenantDeliverySettings TenantDeliverySettings_pkey; Type: CONSTRAINT; Schema: public; Owner: nmd
--

ALTER TABLE ONLY public."TenantDeliverySettings"
    ADD CONSTRAINT "TenantDeliverySettings_pkey" PRIMARY KEY ("tenantId");


--
-- Name: Tenant Tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: nmd
--

ALTER TABLE ONLY public."Tenant"
    ADD CONSTRAINT "Tenant_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: nmd
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: nmd
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_logs whatsapp_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: nmd
--

ALTER TABLE ONLY public.whatsapp_logs
    ADD CONSTRAINT whatsapp_logs_pkey PRIMARY KEY (id);


--
-- Name: CatalogCategory_tenantId_idx; Type: INDEX; Schema: public; Owner: nmd
--

CREATE INDEX "CatalogCategory_tenantId_idx" ON public."CatalogCategory" USING btree ("tenantId");


--
-- Name: CatalogOptionGroup_tenantId_idx; Type: INDEX; Schema: public; Owner: nmd
--

CREATE INDEX "CatalogOptionGroup_tenantId_idx" ON public."CatalogOptionGroup" USING btree ("tenantId");


--
-- Name: CatalogProduct_tenantId_categoryId_idx; Type: INDEX; Schema: public; Owner: nmd
--

CREATE INDEX "CatalogProduct_tenantId_categoryId_idx" ON public."CatalogProduct" USING btree ("tenantId", "categoryId");


--
-- Name: CatalogProduct_tenantId_idx; Type: INDEX; Schema: public; Owner: nmd
--

CREATE INDEX "CatalogProduct_tenantId_idx" ON public."CatalogProduct" USING btree ("tenantId");


--
-- Name: ContestParticipation_contestId_idx; Type: INDEX; Schema: public; Owner: nmd
--

CREATE INDEX "ContestParticipation_contestId_idx" ON public."ContestParticipation" USING btree ("contestId");


--
-- Name: ContestParticipation_customerId_contestId_key; Type: INDEX; Schema: public; Owner: nmd
--

CREATE UNIQUE INDEX "ContestParticipation_customerId_contestId_key" ON public."ContestParticipation" USING btree ("customerId", "contestId");


--
-- Name: ContestParticipation_customerId_idx; Type: INDEX; Schema: public; Owner: nmd
--

CREATE INDEX "ContestParticipation_customerId_idx" ON public."ContestParticipation" USING btree ("customerId");


--
-- Name: Customer_phone_key; Type: INDEX; Schema: public; Owner: nmd
--

CREATE UNIQUE INDEX "Customer_phone_key" ON public."Customer" USING btree (phone);


--
-- Name: DeliveryZone_tenantId_idx; Type: INDEX; Schema: public; Owner: nmd
--

CREATE INDEX "DeliveryZone_tenantId_idx" ON public."DeliveryZone" USING btree ("tenantId");


--
-- Name: Market_slug_key; Type: INDEX; Schema: public; Owner: nmd
--

CREATE UNIQUE INDEX "Market_slug_key" ON public."Market" USING btree (slug);


--
-- Name: Payment_orderId_idx; Type: INDEX; Schema: public; Owner: nmd
--

CREATE INDEX "Payment_orderId_idx" ON public."Payment" USING btree ("orderId");


--
-- Name: Payment_orderId_key; Type: INDEX; Schema: public; Owner: nmd
--

CREATE UNIQUE INDEX "Payment_orderId_key" ON public."Payment" USING btree ("orderId");


--
-- Name: Tenant_slug_key; Type: INDEX; Schema: public; Owner: nmd
--

CREATE UNIQUE INDEX "Tenant_slug_key" ON public."Tenant" USING btree (slug);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: nmd
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: ContestParticipation ContestParticipation_contestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nmd
--

ALTER TABLE ONLY public."ContestParticipation"
    ADD CONSTRAINT "ContestParticipation_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES public."Contest"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: nmd
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."Order"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: nmd
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict WfV7wsGkYRpg5YCkohkPsJPsqkW9Z6H8xvDjM4vZOrOq7bgbhrhk279Waaf7DVU

