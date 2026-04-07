begin;

insert into public.categories (id, name, slug, description, sort_order, is_visible)
values
  ('11111111-1111-1111-1111-111111111111', 'Custom Gifts', 'custom-gifts', 'Personalized keepsakes and curated gift boxes.', 1, true),
  ('22222222-2222-2222-2222-222222222222', 'Crochet', 'crochet', 'Crochet bouquets, accessories, and decorative pieces.', 2, true),
  ('33333333-3333-3333-3333-333333333333', 'Knitted', 'knitted', 'Soft knitted sets, blankets, and newborn gifting items.', 3, true),
  ('44444444-4444-4444-4444-444444444444', 'Seasonal Favors', 'seasonal-favors', 'Limited seasonal decor and event favors.', 4, false)
on conflict (id) do nothing;

insert into public.subcategories (id, category_id, name, slug, description, sort_order, status)
values
  ('aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '11111111-1111-1111-1111-111111111111', 'Gift Boxes', 'gift-boxes', 'Premium handmade gift boxes.', 1, 'live'),
  ('aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '22222222-2222-2222-2222-222222222222', 'Bouquets', 'bouquets', 'Crochet flower arrangements.', 1, 'live'),
  ('aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '33333333-3333-3333-3333-333333333333', 'Baby Sets', 'baby-sets', 'Knitted gifting sets for newborns.', 1, 'live'),
  ('aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaa4', '44444444-4444-4444-4444-444444444444', 'Table Decor', 'table-decor', 'Seasonal decorative table pieces.', 1, 'draft')
on conflict (id) do nothing;

insert into public.products (
  id,
  sku,
  category_id,
  subcategory_id,
  name,
  slug,
  image_url,
  image_alt,
  description,
  price_pkr,
  rating,
  stock_quantity,
  stock_label,
  discount_enabled,
  discount_percentage,
  is_trending,
  is_best_seller,
  is_new_arrival,
  is_top_rated,
  is_deal_of_the_day,
  status,
  created_by,
  updated_by
)
values
  (
    'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    'CBK-201',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'Rose Letter Gift Box',
    'rose-letter-gift-box',
    'https://images.unsplash.com/photo-1512909006721-3d6018887383?auto=format&fit=crop&w=900&q=80',
    'Rose letter gift box',
    'Personalized keepsake box with florals, note card, and satin wrap.',
    6500,
    4.9,
    8,
    'Made to order',
    true,
    10,
    true,
    true,
    false,
    true,
    false,
    'live',
    null,
    null
  ),
  (
    'bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    'CBK-202',
    '22222222-2222-2222-2222-222222222222',
    'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    'Blush Crochet Bouquet',
    'blush-crochet-bouquet',
    'https://images.unsplash.com/photo-1526045431048-f857369baa09?auto=format&fit=crop&w=900&q=80',
    'Blush crochet bouquet',
    'Soft pink crochet bouquet for engagements, birthdays, and keepsakes.',
    4200,
    4.8,
    12,
    '12 units',
    false,
    0,
    true,
    false,
    true,
    false,
    true,
    'live',
    null,
    null
  ),
  (
    'bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
    'CBK-203',
    '33333333-3333-3333-3333-333333333333',
    'aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    'Newborn Knit Hamper',
    'newborn-knit-hamper',
    'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=900&q=80',
    'Newborn knit hamper',
    'Neutral newborn hamper with blanket, cap, mittens, and message tag.',
    7800,
    5.0,
    4,
    '4 sets',
    true,
    12,
    false,
    true,
    false,
    true,
    false,
    'live',
    null,
    null
  ),
  (
    'bbbbbbb4-bbbb-bbbb-bbbb-bbbbbbbbbbb4',
    'CBK-204',
    '22222222-2222-2222-2222-222222222222',
    null,
    'Crochet Daisy Tote',
    'crochet-daisy-tote',
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
    'Crochet daisy tote',
    'Structured tote with daisy motif and cotton lining for casual gifting.',
    3900,
    4.6,
    0,
    'Prototype',
    false,
    0,
    false,
    false,
    true,
    false,
    false,
    'draft',
    null,
    null
  )
on conflict (id) do nothing;

insert into public.product_features (id, product_id, feature, sort_order)
values
  ('c1111111-1111-1111-1111-111111111111', 'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Custom initials', 1),
  ('c1111111-1111-1111-1111-111111111112', 'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Gift note', 2),
  ('c1111111-1111-1111-1111-111111111113', 'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Premium wrap', 3),
  ('c2222222-2222-2222-2222-222222222221', 'bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2', '7 stems', 1),
  ('c2222222-2222-2222-2222-222222222222', 'bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'Dust bag', 2),
  ('c2222222-2222-2222-2222-222222222223', 'bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'Hand card', 3),
  ('c3333333-3333-3333-3333-333333333331', 'bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'Gift-ready', 1),
  ('c3333333-3333-3333-3333-333333333332', 'bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'Soft yarn', 2),
  ('c3333333-3333-3333-3333-333333333333', 'bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'Add-on note', 3),
  ('c4444444-4444-4444-4444-444444444441', 'bbbbbbb4-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'Lined interior', 1),
  ('c4444444-4444-4444-4444-444444444442', 'bbbbbbb4-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'Handmade strap', 2),
  ('c4444444-4444-4444-4444-444444444443', 'bbbbbbb4-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'Limited colorways', 3)
on conflict (id) do nothing;

insert into public.reviews (
  id,
  product_id,
  user_id,
  customer_name,
  rating,
  comment,
  status
)
values
  (
    'd1111111-1111-1111-1111-111111111111',
    'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    null,
    'Hina Ahmed',
    5.0,
    'Packaging felt premium and the initials were perfectly done.',
    'published'
  ),
  (
    'd2222222-2222-2222-2222-222222222222',
    'bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    null,
    'Sara Malik',
    4.0,
    'Beautiful bouquet, delivery was a little tight on time.',
    'pending'
  ),
  (
    'd3333333-3333-3333-3333-333333333333',
    'bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
    null,
    'Noor Fatima',
    5.0,
    'Very soft finishing and the hamper looked exactly like the photos.',
    'flagged'
  )
on conflict (id) do nothing;

insert into public.review_replies (
  id,
  review_id,
  replied_by,
  reply
)
values
  (
    'e1111111-1111-1111-1111-111111111111',
    'd1111111-1111-1111-1111-111111111111',
    null,
    'Thank you. We are glad the custom finishing felt special.'
  )
on conflict (id) do nothing;

insert into public.orders (
  id,
  order_no,
  user_id,
  customer_name,
  customer_email,
  customer_phone,
  city,
  address,
  payment_status,
  fulfillment_status,
  subtotal_pkr,
  discount_pkr,
  shipping_pkr,
  total_pkr,
  notes
)
values
  (
    'f1111111-1111-1111-1111-111111111111',
    'ORD-3201',
    null,
    'Mariam Khan',
    'mariam@example.com',
    '+92-300-1111111',
    'Lahore',
    'DHA Phase 5, Lahore',
    'paid',
    'processing',
    6500,
    0,
    200,
    6700,
    'Gift wrap requested.'
  ),
  (
    'f2222222-2222-2222-2222-222222222222',
    'ORD-3198',
    null,
    'Areeba Noor',
    'areeba@example.com',
    '+92-300-2222222',
    'Karachi',
    'Gulshan-e-Iqbal, Karachi',
    'pending',
    'packed',
    8400,
    0,
    250,
    8650,
    'Call before dispatch.'
  ),
  (
    'f3333333-3333-3333-3333-333333333333',
    'ORD-3189',
    null,
    'Sana Riaz',
    'sana@example.com',
    '+92-300-3333333',
    'Islamabad',
    'F-11, Islamabad',
    'paid',
    'dispatched',
    7800,
    500,
    250,
    7550,
    'Handle as newborn gift.'
  )
on conflict (id) do nothing;

insert into public.order_items (
  id,
  order_id,
  product_id,
  product_name,
  sku,
  quantity,
  unit_price_pkr,
  total_price_pkr
)
values
  (
    'a1111111-1111-1111-1111-111111111111',
    'f1111111-1111-1111-1111-111111111111',
    'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    'Rose Letter Gift Box',
    'CBK-201',
    1,
    6500,
    6500
  ),
  (
    'a2222222-2222-2222-2222-222222222222',
    'f2222222-2222-2222-2222-222222222222',
    'bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    'Blush Crochet Bouquet',
    'CBK-202',
    2,
    4200,
    8400
  ),
  (
    'a3333333-3333-3333-3333-333333333333',
    'f3333333-3333-3333-3333-333333333333',
    'bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3',
    'Newborn Knit Hamper',
    'CBK-203',
    1,
    7800,
    7800
  )
on conflict (id) do nothing;

insert into public.custom_requests (
  id,
  request_no,
  user_id,
  customer_name,
  customer_email,
  customer_phone,
  request_type,
  brief,
  budget_pkr,
  due_date,
  priority,
  status,
  assigned_to
)
values
  (
    'a4444444-4444-4444-4444-444444444444',
    'REQ-71',
    null,
    'Areeba Noor',
    'areeba@example.com',
    '+92-300-4444444',
    'Engagement hamper',
    'Need blush and ivory custom favor boxes with initials for 30 guests.',
    55000,
    '2026-03-29',
    'high',
    'quoted',
    null
  ),
  (
    'a5555555-5555-5555-5555-555555555555',
    'REQ-72',
    null,
    'Sara Malik',
    'sara@example.com',
    '+92-300-5555555',
    'Event bouquet set',
    'Crochet bouquet bar for bridal shower table styling.',
    22000,
    '2026-04-03',
    'medium',
    'in_progress',
    null
  ),
  (
    'a6666666-6666-6666-6666-666666666666',
    'REQ-73',
    null,
    'Noor Fatima',
    'noor@example.com',
    '+92-300-6666666',
    'Newborn gifting set',
    'Personalized knit hamper with baby name and thank-you tags.',
    18000,
    '2026-04-05',
    'high',
    'new',
    null
  )
on conflict (id) do nothing;

insert into public.brand_settings (key, value, updated_by)
values
  (
    'announcement_bar',
    '{"text":"Handmade keepsakes made to order in Pakistan"}'::jsonb,
    null
  ),
  (
    'primary_cta_label',
    '{"text":"Shop curated gifts"}'::jsonb,
    null
  ),
  (
    'review_request_message',
    '{"text":"Tell us how your order felt when it arrived"}'::jsonb,
    null
  ),
  (
    'brand_voice',
    '{"text":"Soft, polished, handmade, premium"}'::jsonb,
    null
  )
on conflict (key) do update
set value = excluded.value,
    updated_by = excluded.updated_by,
    updated_at = now();

commit;
