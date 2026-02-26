--
-- PostgreSQL database dump
--

\restrict altPW15DFVXPdGWEj2NjAek09g9LwqmGwuYNL0B7qQGPHUZLo7pIfcofJOisDlj

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

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
-- Name: role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.role AS ENUM (
    'ADMIN',
    'CUSTOMER',
    'STORE_OWNER',
    'DRIVER'
);


ALTER TYPE public.role OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action_type text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    performed_by_user_id uuid NOT NULL,
    performed_by_role text NOT NULL,
    old_value jsonb,
    new_value jsonb,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: ledger; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reference_id uuid,
    debit_user_id uuid,
    credit_user_id uuid,
    amount numeric(12,2) NOT NULL,
    type text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.ledger OWNER TO postgres;

--
-- Name: stores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name character varying NOT NULL,
    type character varying,
    description text,
    location_text text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.stores OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    email character varying NOT NULL,
    password character varying NOT NULL,
    role public.role DEFAULT 'CUSTOMER'::public.role NOT NULL,
    phone character varying,
    is_approved boolean DEFAULT false,
    transport_type character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    avatar_url text,
    addresses jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: wallets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wallets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    balance numeric(12,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.wallets OWNER TO postgres;

--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, action_type, entity_type, entity_id, performed_by_user_id, performed_by_role, old_value, new_value, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: ledger; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ledger (id, reference_id, debit_user_id, credit_user_id, amount, type, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: stores; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stores (id, owner_id, name, type, description, location_text, created_at, updated_at) FROM stdin;
787f07c8-4b1e-490b-b112-a9f79c7f2b68	e3462444-b4a4-4523-b6f0-2310f21da698	Trial Store 1	Grocery	\N	Sandbox North	2026-02-26 20:11:14.286983	2026-02-26 20:11:14.286983
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, password, role, phone, is_approved, transport_type, created_at, updated_at, avatar_url, addresses) FROM stdin;
f17e3933-61f0-4cc3-bbe0-9bb3729910b6	Admin	admin@mitgaber.com	$2b$10$dZG6uDbHznRDJc16KuRdUuP9gUBp8OpAgqIgfoecA8xvo87huy7Ay	ADMIN	\N	t	\N	2026-02-26 20:07:14.570945	2026-02-26 20:07:14.570945	\N	[]
307b7db3-2cd0-4c43-8107-4306b0682d1d	Admin User	admin@trial.com	$2b$10$pNAunRsU8QP8jDjGeMa9TuOL8IQVz7zsbWn7u8pU0C9vTURwSgLdW	ADMIN	\N	t	\N	2026-02-26 20:11:14.201946	2026-02-26 20:11:14.201946	\N	[]
e3462444-b4a4-4523-b6f0-2310f21da698	Store Owner 1	owner1@trial.com	$2b$10$pNAunRsU8QP8jDjGeMa9TuOL8IQVz7zsbWn7u8pU0C9vTURwSgLdW	STORE_OWNER	\N	t	\N	2026-02-26 20:11:14.242794	2026-02-26 20:11:14.242794	\N	[]
c9c84f8c-be3c-4002-a18b-1717cfe5ffcb	Store Owner 2	owner2@trial.com	$2b$10$pNAunRsU8QP8jDjGeMa9TuOL8IQVz7zsbWn7u8pU0C9vTURwSgLdW	STORE_OWNER	\N	t	\N	2026-02-26 20:11:14.246376	2026-02-26 20:11:14.246376	\N	[]
4fcdef30-01b7-4c69-8a6d-c46889990736	Driver 1	driver1@trial.com	$2b$10$pNAunRsU8QP8jDjGeMa9TuOL8IQVz7zsbWn7u8pU0C9vTURwSgLdW	DRIVER	\N	t	Motorcycle	2026-02-26 20:11:14.249885	2026-02-26 20:11:14.249885	\N	[]
c6e61ebd-975e-4bc4-805c-cde717a95e7f	Driver 2	driver2@trial.com	$2b$10$pNAunRsU8QP8jDjGeMa9TuOL8IQVz7zsbWn7u8pU0C9vTURwSgLdW	DRIVER	\N	t	Bicycle	2026-02-26 20:11:14.253415	2026-02-26 20:11:14.253415	\N	[]
72cdc420-5597-4bf5-a3b7-946c91b70072	Customer 1	cust1@trial.com	$2b$10$pNAunRsU8QP8jDjGeMa9TuOL8IQVz7zsbWn7u8pU0C9vTURwSgLdW	CUSTOMER	\N	t	\N	2026-02-26 20:11:14.257228	2026-02-26 20:11:14.257228	\N	[]
832cdf55-f3f3-46e5-b6ec-0decde929487	Customer 2	cust2@trial.com	$2b$10$pNAunRsU8QP8jDjGeMa9TuOL8IQVz7zsbWn7u8pU0C9vTURwSgLdW	CUSTOMER	\N	t	\N	2026-02-26 20:11:14.2607	2026-02-26 20:11:14.2607	\N	[]
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wallets (id, user_id, balance, created_at, updated_at) FROM stdin;
5eb19912-2a63-4f23-b566-00063e0913f6	f17e3933-61f0-4cc3-bbe0-9bb3729910b6	0.00	2026-02-26 20:07:14.570945	2026-02-26 20:07:14.570945
c1f7ffc4-90cd-4905-8270-f804a3dc6553	307b7db3-2cd0-4c43-8107-4306b0682d1d	1000.00	2026-02-26 20:11:14.26399	2026-02-26 20:11:14.26399
62a7e5e9-2e06-49a5-b947-9871babacd22	e3462444-b4a4-4523-b6f0-2310f21da698	1000.00	2026-02-26 20:11:14.267726	2026-02-26 20:11:14.267726
6e694ead-51ea-45eb-be15-bb06ab3d3ce6	c9c84f8c-be3c-4002-a18b-1717cfe5ffcb	1000.00	2026-02-26 20:11:14.271187	2026-02-26 20:11:14.271187
12ebfac8-ce4d-4333-ab5d-ac298d92e7ef	4fcdef30-01b7-4c69-8a6d-c46889990736	1000.00	2026-02-26 20:11:14.274827	2026-02-26 20:11:14.274827
50000131-2a3c-4986-ae1e-c83c46cc2cb6	c6e61ebd-975e-4bc4-805c-cde717a95e7f	1000.00	2026-02-26 20:11:14.27819	2026-02-26 20:11:14.27819
08939de2-8533-41e7-beae-0daf2cc25596	72cdc420-5597-4bf5-a3b7-946c91b70072	1000.00	2026-02-26 20:11:14.281125	2026-02-26 20:11:14.281125
863488cb-8716-4a44-8fb3-457bf4c0689d	832cdf55-f3f3-46e5-b6ec-0decde929487	1000.00	2026-02-26 20:11:14.284035	2026-02-26 20:11:14.284035
\.


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: ledger ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ledger
    ADD CONSTRAINT ledger_pkey PRIMARY KEY (id);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_performed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_performed_by_user_id_fkey FOREIGN KEY (performed_by_user_id) REFERENCES public.users(id);


--
-- Name: ledger ledger_credit_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ledger
    ADD CONSTRAINT ledger_credit_user_id_fkey FOREIGN KEY (credit_user_id) REFERENCES public.users(id);


--
-- Name: ledger ledger_debit_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ledger
    ADD CONSTRAINT ledger_debit_user_id_fkey FOREIGN KEY (debit_user_id) REFERENCES public.users(id);


--
-- Name: stores stores_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: wallets wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict altPW15DFVXPdGWEj2NjAek09g9LwqmGwuYNL0B7qQGPHUZLo7pIfcofJOisDlj

