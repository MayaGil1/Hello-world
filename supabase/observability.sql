-- CapCity observability: the caption generator is driven by these tables and logs every AI call,
-- so the admin panel can see and tune what the AI does. Run once in the Supabase SQL Editor.
--
-- RLS design: every table below has RLS on and NO policies, so the publishable key can't read or
-- write any of them. Only the server (secret key) touches them: CapCity's generator and the admin panel.

-- LLM providers and models ----------------------------------------------------------------------

create table if not exists public.llm_providers (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,          -- the code picks the API client by slug; only 'google' is implemented
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.llm_models (
  id bigint generated always as identity primary key,
  llm_provider_id bigint not null references public.llm_providers (id) on delete restrict,
  name text not null,
  provider_model_id text not null,    -- the id sent to the provider's API, e.g. gemini-3.5-flash
  is_temperature_supported boolean not null default true,
  is_active boolean not null default true, -- inactive models are skipped, including as fallbacks
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prompt chains: a chain is an ordered list of LLM steps; the mix says how many of each post's
-- captions come from each chain.  -------------------------------------------------------------

create table if not exists public.prompt_chains (
  id bigint generated always as identity primary key,
  slug text not null unique,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.prompt_chain_steps (
  id bigint generated always as identity primary key,
  prompt_chain_id bigint not null references public.prompt_chains (id) on delete cascade,
  order_by smallint not null,
  description text not null,
  llm_model_id bigint not null references public.llm_models (id) on delete restrict,
  input_type text not null check (input_type in ('image', 'text', 'image_and_text')),
  output_type text not null check (output_type in ('text', 'captions')),
  temperature numeric,
  system_prompt text not null,
  user_prompt text not null,          -- {{theme}} {{note}} {{count}} {{terms}} {{examples}} {{previous}}
  created_at timestamptz not null default now(),
  unique (prompt_chain_id, order_by)
);

create table if not exists public.prompt_chain_mix (
  id bigint generated always as identity primary key,
  prompt_chain_id bigint not null unique references public.prompt_chains (id) on delete cascade,
  caption_count smallint not null default 0 check (caption_count between 0 and 10),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

-- Prompt ingredients ------------------------------------------------------------------------------

create table if not exists public.terms (
  id bigint generated always as identity primary key,
  term text not null,
  definition text not null,
  example text not null default '',
  priority smallint not null default 0, -- highest priority terms go into the prompt first
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.caption_examples (
  id bigint generated always as identity primary key,
  image_description text not null,
  caption text not null,
  explanation text not null default '',
  priority smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Logs: one generation request per "make captions" click, one llm response per model call. -------

create table if not exists public.generation_requests (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  post_id bigint references public.posts (id) on delete set null,
  image_path text not null,
  theme text not null,
  note text,
  source text not null default 'capcity', -- capcity | admin
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  error text,
  caption_count int not null default 0,
  duration_ms int,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.llm_responses (
  id bigint generated always as identity primary key,
  generation_request_id bigint not null references public.generation_requests (id) on delete cascade,
  prompt_chain_id bigint references public.prompt_chains (id) on delete set null,
  prompt_chain_step_id bigint references public.prompt_chain_steps (id) on delete set null,
  llm_model_id bigint references public.llm_models (id) on delete set null,
  provider_model_id text not null,
  system_prompt text not null,
  user_prompt text not null,
  temperature numeric,
  response text,
  http_status int,
  error text,
  duration_ms int not null,
  created_at timestamptz not null default now()
);

alter table public.captions
  add column if not exists generation_request_id bigint references public.generation_requests (id) on delete set null,
  add column if not exists prompt_chain_id bigint references public.prompt_chains (id) on delete set null;

-- Who may sign in to CapCity. If BOTH lists are empty, anyone can sign in. -----------------------

create table if not exists public.allowed_signup_domains (
  id bigint generated always as identity primary key,
  apex_domain text not null unique check (apex_domain = lower(apex_domain) and apex_domain !~ '[@\s]'),
  created_at timestamptz not null default now()
);

create table if not exists public.whitelist_email_addresses (
  id bigint generated always as identity primary key,
  email_address text not null unique check (email_address = lower(email_address) and email_address ~ '^[^@\s]+@[^@\s]+$'),
  created_at timestamptz not null default now()
);

create index if not exists llm_models_provider_idx on public.llm_models (llm_provider_id);
create index if not exists prompt_chain_steps_model_idx on public.prompt_chain_steps (llm_model_id);
create index if not exists generation_requests_created_idx on public.generation_requests (created_at desc);
create index if not exists generation_requests_user_idx on public.generation_requests (user_id);
create index if not exists generation_requests_post_idx on public.generation_requests (post_id);
create index if not exists llm_responses_request_idx on public.llm_responses (generation_request_id);
create index if not exists llm_responses_created_idx on public.llm_responses (created_at desc);
create index if not exists captions_generation_request_idx on public.captions (generation_request_id);

alter table public.llm_providers enable row level security;
alter table public.llm_models enable row level security;
alter table public.prompt_chains enable row level security;
alter table public.prompt_chain_steps enable row level security;
alter table public.prompt_chain_mix enable row level security;
alter table public.terms enable row level security;
alter table public.caption_examples enable row level security;
alter table public.generation_requests enable row level security;
alter table public.llm_responses enable row level security;
alter table public.allowed_signup_domains enable row level security;
alter table public.whitelist_email_addresses enable row level security;

-- Starting data (only inserted the first time) -------------------------------------------------

insert into public.llm_providers (name, slug)
select 'Google Gemini', 'google'
where not exists (select 1 from public.llm_providers where slug = 'google');

insert into public.llm_models (llm_provider_id, name, provider_model_id)
select p.id, m.name, m.model
from public.llm_providers p,
     (values ('Gemini 3.5 Flash', 'gemini-3.5-flash'), ('Gemini 3.8 Flash', 'gemini-3.8-flash')) as m (name, model)
where p.slug = 'google'
  and not exists (select 1 from public.llm_models x where x.provider_model_id = m.model);

insert into public.prompt_chains (slug, description)
values
  ('describe-then-caption', 'Two steps: describe the photo first, then write captions from that description. Usually more specific.'),
  ('one-shot', 'One step: look at the photo and write captions directly. Faster, one model call.')
on conflict (slug) do nothing;

insert into public.prompt_chain_steps
  (prompt_chain_id, order_by, description, llm_model_id, input_type, output_type, temperature, system_prompt, user_prompt)
select c.id, s.order_by, s.description,
       (select id from public.llm_models where provider_model_id = 'gemini-3.5-flash'),
       s.input_type, s.output_type, s.temperature, s.system_prompt, s.user_prompt
from public.prompt_chains c
join (values
  ('describe-then-caption', 1, 'Describe the photo', 'image', 'text', 0.2,
   'You describe photos for a comedy writer. Be concrete and literal. No jokes.',
   E'Describe this photo in 4-6 short bullet points: setting, people/animals/objects, what is happening, any visible text, anything odd or funny-looking.\nToday''s theme is "{{theme}}".\nContext from the person who posted it: {{note}}'),
  ('describe-then-caption', 2, 'Write captions from the description', 'text', 'captions', 1.0,
   E'You write captions for CapCity, a photo-caption app for Columbia College students. The typical user is chronically online, grew up in the Midwest, is fairly new to New York City, lives in the dorms and explores the city on weekends.',
   E'Photo description:\n{{previous}}\n\nWrite {{count}} funny, specific captions for this photo. Spread them across these styles: Chronically online, Midwest transplant, Columbia insider, Deadpan, Wholesome.\nToday''s theme is "{{theme}}". Lean into it if it fits.\nContext from the poster: {{note}}\n\nCampus and city slang you can use when it fits:\n{{terms}}\n\nExamples of captions that worked well:\n{{examples}}\n\nRules: under 120 characters each, refer to what is actually in the photo, no hashtags, nothing mean about a real person''s appearance, no slurs.'),
  ('one-shot', 1, 'Look at the photo and write captions', 'image_and_text', 'captions', 1.0,
   E'You write captions for CapCity, a photo-caption app for Columbia College students. The typical user is chronically online, grew up in the Midwest, is fairly new to New York City, lives in the dorms and explores the city on weekends.',
   E'Write {{count}} funny, specific captions for the attached photo. Spread them across these styles: Chronically online, Midwest transplant, Columbia insider, Deadpan, Wholesome.\nToday''s theme is "{{theme}}". Lean into it if it fits.\nContext from the poster: {{note}}\n\nCampus and city slang you can use when it fits:\n{{terms}}\n\nExamples of captions that worked well:\n{{examples}}\n\nRules: under 120 characters each, refer to what is actually in the photo, no hashtags, nothing mean about a real person''s appearance, no slurs.')
) as s (chain, order_by, description, input_type, output_type, temperature, system_prompt, user_prompt)
  on s.chain = c.slug
on conflict (prompt_chain_id, order_by) do nothing;

insert into public.prompt_chain_mix (prompt_chain_id, caption_count)
select id, case slug when 'describe-then-caption' then 3 else 2 end
from public.prompt_chains
on conflict (prompt_chain_id) do nothing;

insert into public.terms (term, definition, example, priority)
select * from (values
  ('Butler', 'Butler Library, where students pull all-nighters during finals.', 'Butler at 2am is a personality trait.', 5),
  ('John Jay', 'John Jay Dining Hall.', 'John Jay mozzarella sticks are a love language.', 4),
  ('the Steps', 'The Low Library steps, where everyone sits when it''s sunny.', 'First warm day and the Steps are a beach.', 4),
  ('the 1 train', 'The subway line that stops at 116th St–Columbia University.', 'The 1 train is never on time when you are late.', 3),
  ('Morningside', 'Morningside Heights, the neighborhood around campus.', 'Morningside rent called, it wants your kidney.', 2),
  ('bodega cat', 'The cat that lives in a corner store. Beloved, unbothered.', 'The bodega cat has more NYC experience than me.', 2)
) as t (term, definition, example, priority)
where not exists (select 1 from public.terms);

insert into public.caption_examples (image_description, caption, explanation, priority)
select * from (values
  ('A crowded subway car, everyone looking at their phones.', 'POV: the 1 train decided today is a group project.', 'Specific place + relatable student framing.', 3),
  ('A pigeon eating a whole slice of pizza on the sidewalk.', 'He has a 9am too. He is coping.', 'Gives the animal a student problem; short and deadpan.', 2)
) as e (image_description, caption, explanation, priority)
where not exists (select 1 from public.caption_examples);

select
  (select count(*) from public.llm_providers) as providers,
  (select count(*) from public.llm_models) as models,
  (select count(*) from public.prompt_chains) as chains,
  (select count(*) from public.prompt_chain_steps) as steps,
  (select count(*) from public.terms) as terms,
  (select count(*) from public.caption_examples) as examples;
