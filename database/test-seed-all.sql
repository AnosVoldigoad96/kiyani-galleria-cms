-- Test seed (full). Populates every user-facing table so the CMS, storefront,
-- accounting, and SEO features can be tested end-to-end.
--
-- Idempotent: every INSERT uses stable UUIDs + ON CONFLICT. Safe to re-run.
-- Skipped tables (require real auth.users rows): profiles, carts, cart_items,
-- favorites. Seed those manually in the CMS after signing up.
--
-- Apply with: node scripts/apply-seo-migrations.mjs  (runs this via run_sql)
-- or via Hasura Console → Data → SQL.

begin;

-- ─────────────────────────────────────────────────────────────── categories ──
insert into public.categories (id, name, slug, description, sort_order, is_visible,
  meta_title, meta_description, keywords, og_title, og_description) values
  ('11111111-1111-1111-1111-111111111111','Custom Gifts','custom-gifts',
   'Personalized keepsakes and curated gift boxes.',1,true,
   'Custom Handmade Gifts — Personalized in Arifwala',
   'Shop personalized handmade gift boxes from Kiyani Galleria — each piece made to order in Arifwala, Punjab.',
   'custom gifts Pakistan, personalized gift box, handmade gifts Arifwala, nikah gift, bespoke gifting',
   'Custom Gifts from Kiyani Galleria',
   'Personalized keepsake boxes, gift hampers, and curated sets — sister-crafted, one at a time.'),
  ('22222222-2222-2222-2222-222222222222','Crochet','crochet',
   'Crochet bouquets, accessories, and decorative pieces.',2,true,
   'Crochet Bouquets & Gifts | Kiyani Galleria',
   'Hand-crocheted bouquets, totes, and keepsakes from Pakistan. Soft cotton yarn, long-lasting flowers that never wilt.',
   'crochet bouquet Pakistan, crochet gift, handmade roses, crochet tote, wedding bouquet alternative',
   'Crochet Bouquets — Flowers That Last Forever',
   'Hand-stitched flowers in cotton yarn — for weddings, birthdays, and everyday gifting.'),
  ('33333333-3333-3333-3333-333333333333','Knitted','knitted',
   'Soft knitted sets, blankets, and newborn gifting items.',3,true,
   'Knitted Baby Gifts & Hampers | Kiyani Galleria',
   'Knitted baby sets, blankets, and gift hampers — soft cotton yarn, delivered across Pakistan.',
   'knitted baby set, baby shower gift Pakistan, aqiqah gift, newborn hamper, knitted blanket',
   'Knitted Newborn Gifts',
   'Cotton-yarn hampers that feel as soft as they look — perfect for baby showers and aqiqahs.'),
  ('44444444-4444-4444-4444-444444444444','Seasonal Favors','seasonal-favors',
   'Limited seasonal decor and event favors.',4,true,
   'Seasonal Favors — Ramadan, Eid, Weddings',
   'Limited seasonal centerpieces, favors, and decor — handmade in Arifwala for Ramadan, Eid, and wedding events.',
   'seasonal favors Pakistan, Ramadan decor, Eid gift, wedding favor, Iftar table',
   'Seasonal Favors',
   'Handmade decor for the moments that matter — Ramadan, Eid, weddings, and everything in between.'),
  ('55555555-5555-5555-5555-555555555555','Paper Crafts','paper-crafts',
   'Shadow boxes, 3D cards, and framed paper art.',5,true,
   'Paper Crafts, Shadow Boxes & 3D Cards',
   'Layered paper art, framed shadow boxes, and bespoke 3D cards — handmade in Arifwala.',
   'paper craft Pakistan, shadow box frame, 3D card, layered paper art, handmade paper gifts',
   'Paper Crafts from Kiyani Galleria',
   'Layered cardstock, laser-precise, assembled by hand — gifting art you can hang.'),
  ('66666666-6666-6666-6666-666666666666','Hand Painted','hand-painted',
   'Hand-painted dupattas, canvases, and cushion covers.',6,true,
   'Hand-Painted Dupattas & Canvases | Kiyani Galleria',
   'Hand-painted dupattas, canvases, and cushion covers — soft fabric paints, colorfast finishing.',
   'hand painted dupatta, painted canvas, mayun dupatta, handmade painted gift, fabric painting Pakistan',
   'Hand-Painted Fabric Gifts',
   'Fabric art you can wear or frame — painted by hand in Arifwala.'),
  ('77777777-7777-7777-7777-777777777777','Wooden Keepsakes','wooden-keepsakes',
   'Laser-cut and hand-finished wooden name plaques.',7,true,
   'Wooden Name Plaques & Keepsakes',
   'Laser-cut wooden name plaques, milestone boards, and keepsake boxes — hand-finished in Pakistan.',
   'wooden name plaque, laser cut wood gift, keepsake box, milestone board, handmade wood Pakistan',
   'Wooden Keepsakes from Kiyani Galleria',
   'Walnut-finish wood, hand-painted details — names, dates, and stories you can hold.'),
  ('88888888-8888-8888-8888-888888888888','Balloon Gifting','balloon-gifting',
   'Styled balloon reveal packages and gift boxes.',8,true,
   'Balloon Gift Boxes & Reveal Packages',
   'Styled balloon-filled reveal boxes for birthdays, gender reveals, and graduations. Delivered across Pakistan.',
   'balloon gift box, reveal box Pakistan, birthday balloon, gender reveal, graduation gift',
   'Balloon-Packed Gifts',
   'Pop-the-box surprise packages — styled, filled, and delivered ready.'),
  ('99999999-9999-9999-9999-999999999999','Nikaah Namas','nikaah-namas',
   'Decorated nikaah nama booklets for weddings.',9,true,
   'Decorated Nikaah Namas | Kiyani Galleria',
   'Ornate nikaah nama folders hand-decorated with gold foil, calligraphy, and dried flowers. Heirloom-worthy.',
   'nikaah nama decoration, nikah nama folder, wedding nama, custom nikaah gift, Pakistani wedding',
   'Decorated Nikaah Namas',
   'A nikaah nama worthy of the occasion — gold-leaf calligraphy, floral details, heirloom finish.')
on conflict (id) do update set
  description = excluded.description,
  is_visible = excluded.is_visible,
  meta_title = excluded.meta_title,
  meta_description = excluded.meta_description,
  keywords = excluded.keywords,
  og_title = excluded.og_title,
  og_description = excluded.og_description;

-- ──────────────────────────────────────────────────────────── subcategories ──
insert into public.subcategories (id, category_id, name, slug, description, sort_order, status) values
  ('aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1','11111111-1111-1111-1111-111111111111','Gift Boxes','gift-boxes','Premium handmade gift boxes.',1,'live'),
  ('aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2','22222222-2222-2222-2222-222222222222','Bouquets','bouquets','Crochet flower arrangements.',1,'live'),
  ('aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3','33333333-3333-3333-3333-333333333333','Baby Sets','baby-sets','Knitted gifting sets for newborns.',1,'live'),
  ('aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaa4','44444444-4444-4444-4444-444444444444','Table Decor','table-decor','Seasonal decorative table pieces.',1,'live'),
  ('aaaaaaa5-aaaa-aaaa-aaaa-aaaaaaaaaaa5','55555555-5555-5555-5555-555555555555','Shadow Boxes','shadow-boxes','3D framed paper arrangements.',1,'live'),
  ('aaaaaaa6-aaaa-aaaa-aaaa-aaaaaaaaaaa6','66666666-6666-6666-6666-666666666666','Dupattas','dupattas','Hand-painted dupattas.',1,'live'),
  ('aaaaaaa7-aaaa-aaaa-aaaa-aaaaaaaaaaa7','77777777-7777-7777-7777-777777777777','Name Plaques','name-plaques','Personalized wooden plaques.',1,'live'),
  ('aaaaaaa8-aaaa-aaaa-aaaa-aaaaaaaaaaa8','88888888-8888-8888-8888-888888888888','Reveal Boxes','reveal-boxes','Balloon-filled surprise boxes.',1,'live'),
  ('aaaaaaa9-aaaa-aaaa-aaaa-aaaaaaaaaaa9','99999999-9999-9999-9999-999999999999','Decorated Namas','decorated-namas','Ornate nikaah nama covers.',1,'live')
on conflict (id) do update set
  description = excluded.description,
  status = excluded.status;

-- ───────────────────────────────────────────────────────────────── products ──
insert into public.products (id, sku, category_id, subcategory_id, name, slug,
  image_url, image_alt, description, price_pkr, our_price_pkr, rating, stock_quantity,
  stock_label, discount_enabled, discount_percentage, is_trending, is_best_seller,
  is_new_arrival, is_top_rated, is_deal_of_the_day, status,
  meta_title, meta_description, keywords, og_title, og_description,
  sitemap_priority, sitemap_changefreq) values
  ('bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1','CBK-201','11111111-1111-1111-1111-111111111111','aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
   'Rose Letter Gift Box','rose-letter-gift-box',
   'https://images.unsplash.com/photo-1512909006721-3d6018887383?auto=format&fit=crop&w=900&q=80',
   'Handmade gift box with fresh roses, initials and satin ribbon',
   'Personalized keepsake box with florals, note card, and satin wrap. Made-to-order with your initials or a short message, presented in a reusable kraft box.',
   6500,5850,4.9,8,'Made to order',true,10,true,true,false,true,false,'live',
   'Rose Letter Gift Box — Personalized Keepsake',
   'Made-to-order rose letter gift box with initials, satin wrap, and premium gifting finish. Ships in 5-7 days.',
   'rose gift box, personalized keepsake, initial gift box, nikah gift, anniversary gift Pakistan',
   'Rose Letter Gift Box — Made to Order',
   'A keepsake box worth unboxing slowly. Florals, your initials, satin ribbon — all made to order.',
   0.9,'weekly'),

  ('bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2','CBK-202','22222222-2222-2222-2222-222222222222','aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
   'Blush Crochet Bouquet','blush-crochet-bouquet',
   'https://images.unsplash.com/photo-1526045431048-f857369baa09?auto=format&fit=crop&w=900&q=80',
   'Hand-crocheted blush-pink rose bouquet with 7 stems',
   'Soft pink crochet bouquet for engagements, birthdays, and keepsakes. Seven hand-stitched roses with cotton leaves, wrapped in a hand-painted kraft sleeve.',
   4200,4200,4.8,12,'12 units',false,0,true,false,true,false,true,'live',
   'Blush Crochet Bouquet — 7 Hand-Stitched Roses',
   'Hand-crocheted blush bouquet, 7 roses in cotton yarn, wrapped in painted kraft. Flowers that last forever.',
   'blush crochet bouquet, hand crochet roses, wedding bouquet alternative, birthday bouquet Pakistan',
   'Blush Crochet Bouquet',
   'Seven hand-crocheted blush roses — the kind of bouquet you keep forever.',
   0.9,'weekly'),

  ('bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3','CBK-203','33333333-3333-3333-3333-333333333333','aaaaaaa3-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
   'Newborn Knit Hamper','newborn-knit-hamper',
   'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=900&q=80',
   'Neutral knitted newborn gift hamper with blanket, cap and mittens',
   'Neutral newborn hamper with blanket, cap, mittens, and message tag. 100% cotton yarn, gentle on baby skin. Ideal baby shower and aqiqah gift.',
   7800,6864,5.0,4,'4 sets',true,12,false,true,false,true,false,'live',
   'Newborn Knit Hamper — Gift-Ready Baby Set',
   'Neutral knitted newborn hamper: blanket, cap, mittens, message tag. 100% cotton. Baby shower ready.',
   'newborn knit hamper, baby shower gift, aqiqah hamper, knitted baby set Pakistan',
   'Newborn Knit Hamper',
   'Blanket, cap, mittens, tag — neatly boxed for baby''s first hamper.',
   0.8,'monthly'),

  ('bbbbbbb4-bbbb-bbbb-bbbb-bbbbbbbbbbb4','CBK-204','22222222-2222-2222-2222-222222222222',null,
   'Crochet Daisy Tote','crochet-daisy-tote',
   'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
   'Hand-crocheted cream tote with yellow daisy motif',
   'Structured tote with daisy motif and cotton lining for casual gifting. Prototype; stocked irregularly.',
   3900,3900,4.6,0,'Prototype',false,0,false,false,true,false,false,'draft',
   'Crochet Daisy Tote — Prototype',
   'Prototype tote — stocked irregularly. Hidden from search.',
   null,null,null,
   null,null),

  ('bbbbbbb5-bbbb-bbbb-bbbb-bbbbbbbbbbb5','CBK-205','55555555-5555-5555-5555-555555555555','aaaaaaa5-aaaa-aaaa-aaaa-aaaaaaaaaaa5',
   'Floral Shadow Box Frame','floral-shadow-box-frame',
   'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=900&q=80',
   'Shadow box frame with layered paper flowers and gold accents',
   '3D paper floral arrangement set in a 10x10 shadow box with personalized couple names. Layered cardstock in champagne, blush, and ivory.',
   5800,5220,4.9,6,'6 available',true,10,true,false,true,true,false,'live',
   'Floral Shadow Box Frame — 3D Paper Art',
   'Layered paper floral shadow box with personalized names. Champagne, blush, ivory cardstock. 10x10 frame.',
   'shadow box frame, paper flowers, 3D paper art, couple name frame, wedding gift Pakistan',
   'Floral Shadow Box Frame',
   'Paper flowers, layered like a garden — framed with your names in gold.',
   0.8,'monthly'),

  ('bbbbbbb6-bbbb-bbbb-bbbb-bbbbbbbbbbb6','CBK-206','66666666-6666-6666-6666-666666666666','aaaaaaa6-aaaa-aaaa-aaaa-aaaaaaaaaaa6',
   'Hand-Painted Ivory Dupatta','hand-painted-ivory-dupatta',
   'https://images.unsplash.com/photo-1583391733975-d6e5e3e96baf?auto=format&fit=crop&w=900&q=80',
   'Hand-painted ivory cotton dupatta with delicate floral border',
   'Cotton dupatta painted by hand with a fine floral vine border. Lightweight, colorfast. 2.5 metres, finished edges. Pairs with kurtas or bridal mayun sets.',
   9800,8820,5.0,3,'3 left',true,10,true,true,true,true,false,'live',
   'Hand-Painted Ivory Dupatta — Floral Border',
   'Cotton dupatta painted by hand with a fine floral vine border. 2.5m, colorfast, lightweight. Mayun-ready.',
   'hand painted dupatta Pakistan, mayun dupatta, painted cotton dupatta, bridal dupatta',
   'Hand-Painted Ivory Dupatta',
   'Cotton, hand-painted, and ready for your mayun. A heirloom in the making.',
   0.9,'weekly'),

  ('bbbbbbb7-bbbb-bbbb-bbbb-bbbbbbbbbbb7','CBK-207','77777777-7777-7777-7777-777777777777','aaaaaaa7-aaaa-aaaa-aaaa-aaaaaaaaaaa7',
   'Custom Wooden Name Plaque','custom-wooden-name-plaque',
   'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=900&q=80',
   'Laser-cut walnut wooden name plaque with hand-painted detail',
   'Walnut-finish plaque laser-cut to your chosen name or calligraphy, hand-finished with acrylic detailing. Ships ready-to-mount.',
   4500,4500,4.7,15,'In stock',false,0,false,true,false,true,false,'live',
   'Custom Wooden Name Plaque — Walnut Finish',
   'Walnut-finish laser-cut wooden name plaque, hand-finished with acrylic detailing. Ships ready-to-mount.',
   'wooden name plaque, custom name sign, laser cut wood, home decor Pakistan, couple plaque',
   'Custom Wooden Name Plaque',
   'Your name, walnut-cut and hand-finished. Simple, solid, heirloom.',
   0.8,'monthly'),

  ('bbbbbbb8-bbbb-bbbb-bbbb-bbbbbbbbbbb8','CBK-208','88888888-8888-8888-8888-888888888888','aaaaaaa8-aaaa-aaaa-aaaa-aaaaaaaaaaa8',
   'Pastel Balloon Reveal Box','pastel-balloon-reveal-box',
   'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&w=900&q=80',
   'Pastel balloon-filled reveal box with ribbons and gift inside',
   'Styled 16x16 reveal box packed with pastel latex balloons around your choice of gift. Ideal for birthdays, gender reveals, and graduations.',
   5200,4680,4.8,10,'10 available',true,10,true,false,true,false,true,'live',
   'Pastel Balloon Reveal Box — Surprise Gifting',
   'Styled 16-inch balloon reveal box in pastels, packed around your gift. Birthdays, reveals, graduations.',
   'balloon reveal box, birthday balloon box, gender reveal Pakistan, graduation gift',
   'Pastel Balloon Reveal Box',
   'Open the lid, balloons escape, the gift appears. That kind of moment.',
   0.8,'weekly'),

  ('bbbbbbb9-bbbb-bbbb-bbbb-bbbbbbbbbbb9','CBK-209','99999999-9999-9999-9999-999999999999','aaaaaaa9-aaaa-aaaa-aaaa-aaaaaaaaaaa9',
   'Gilded Nikaah Nama Folder','gilded-nikaah-nama-folder',
   'https://images.unsplash.com/photo-1533008732446-ad98dde5aac7?auto=format&fit=crop&w=900&q=80',
   'Gold-detailed nikaah nama folder with floral motif',
   'Ornate nikaah nama folder hand-decorated with gold foil calligraphy and a dried-flower spray. Includes inner booklet, sealable closure, and gift envelope.',
   8500,8500,5.0,7,'7 available',false,0,false,true,true,true,false,'live',
   'Gilded Nikaah Nama Folder — Gold Foil & Florals',
   'Hand-decorated nikaah nama folder with gold foil calligraphy and dried flowers. Heirloom finish.',
   'nikaah nama folder, decorated nikah nama, wedding folder Pakistan, gold foil nama',
   'Gilded Nikaah Nama Folder',
   'Gold-foil calligraphy, pressed florals, sealed with love — a nikaah nama worth keeping.',
   0.9,'monthly'),

  ('bbbbbbba-bbbb-bbbb-bbbb-bbbbbbbbbbba','CBK-210','44444444-4444-4444-4444-444444444444','aaaaaaa4-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
   'Ramadan Table Centerpiece','ramadan-table-centerpiece',
   'https://images.unsplash.com/photo-1517398660890-dbe4a54a9be4?auto=format&fit=crop&w=900&q=80',
   'Handmade Ramadan table centerpiece with moon and lantern accents',
   'Crescent moon and lantern-themed centerpiece in navy and gold. Hand-painted MDF, sized for a dining or iftar table.',
   3500,3500,4.6,0,'Seasonal',false,0,false,false,false,false,false,'live',
   'Ramadan Table Centerpiece — Crescent & Lantern',
   'Hand-painted navy and gold Ramadan centerpiece with crescent moon and lantern detailing. Iftar table ready.',
   'Ramadan centerpiece, iftar decor, Eid table, handmade Ramadan Pakistan',
   'Ramadan Table Centerpiece',
   'Navy, gold, crescent moon — the kind of centerpiece an iftar deserves.',
   0.5,'yearly'),

  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','CBK-211','22222222-2222-2222-2222-222222222222','aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
   'Ivory Crochet Pocket Bouquet','ivory-crochet-pocket-bouquet',
   'https://images.unsplash.com/photo-1508669232496-137b159c1cdb?auto=format&fit=crop&w=900&q=80',
   'Mini ivory crochet bouquet with five stems and lace wrap',
   'Pocket-sized crochet bouquet with five ivory roses and sprigs of baby-breath. Finished with lace and a twine bow.',
   2800,2520,4.7,20,'In stock',true,10,true,false,true,false,false,'live',
   'Ivory Crochet Pocket Bouquet — 5 Mini Roses',
   'Pocket-sized crochet bouquet, 5 ivory roses, lace wrap. Ideal stocking-filler or proposal prop.',
   'mini crochet bouquet, pocket bouquet, ivory crochet roses, small gift Pakistan',
   'Ivory Crochet Pocket Bouquet',
   'Tiny roses. Big meaning. Pocket-sized but not pocket-priced.',
   0.7,'monthly'),

  ('bbbbbbbc-bbbb-bbbb-bbbb-bbbbbbbbbbbc','CBK-212','77777777-7777-7777-7777-777777777777',null,
   'Engraved Couples Keepsake Box','engraved-couples-keepsake-box',
   'https://images.unsplash.com/photo-1519947486511-46149fa0a254?auto=format&fit=crop&w=900&q=80',
   'Walnut keepsake box with engraved couple initials and date',
   'Walnut wood keepsake box engraved with couple initials and date; interior lined with velvet. Sized for rings, watches, or letters.',
   7200,7200,4.8,5,'5 available',false,0,false,true,false,true,false,'live',
   'Engraved Couples Keepsake Box — Walnut',
   'Walnut wood keepsake box engraved with couple initials and date. Velvet-lined, gift-ready.',
   'couples keepsake box, engraved wooden box, wedding gift Pakistan, anniversary keepsake',
   'Engraved Couples Keepsake Box',
   'Walnut, velvet-lined, initials-and-a-date. For the couple that collects memories.',
   0.8,'monthly')
on conflict (id) do update set
  description = excluded.description,
  our_price_pkr = excluded.our_price_pkr,
  status = excluded.status,
  image_alt = excluded.image_alt,
  discount_enabled = excluded.discount_enabled,
  meta_title = excluded.meta_title,
  meta_description = excluded.meta_description,
  keywords = excluded.keywords,
  og_title = excluded.og_title,
  og_description = excluded.og_description,
  sitemap_priority = excluded.sitemap_priority,
  sitemap_changefreq = excluded.sitemap_changefreq;

-- One product flagged noindex (prototype, hidden from Google / sitemap)
update public.products set robots_noindex = true where id = 'bbbbbbb4-bbbb-bbbb-bbbb-bbbbbbbbbbb4';

-- Structured-data-overrides escape hatch on the keepsake box
update public.products set
  structured_data_overrides = jsonb_build_object(
    'material','Walnut wood','color','Brown',
    'audience', jsonb_build_object(
      '@type','PeopleAudience',
      'suggestedMinAge',18,
      'audienceType','Engaged and married couples'),
    'isFamilyFriendly',true)
where id = 'bbbbbbbc-bbbb-bbbb-bbbb-bbbbbbbbbbbc';

-- ──────────────────────────────────────────────────────── product_features ──
insert into public.product_features (id, product_id, feature, sort_order) values
  ('c1111111-1111-1111-1111-111111111111','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1','Personalized initials',1),
  ('c1111111-1111-1111-1111-111111111112','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1','Hand-written note card',2),
  ('c1111111-1111-1111-1111-111111111113','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1','Satin ribbon wrap',3),
  ('c2222222-2222-2222-2222-222222222221','bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2','Seven hand-stitched roses',1),
  ('c2222222-2222-2222-2222-222222222222','bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2','Dust bag included',2),
  ('c2222222-2222-2222-2222-222222222223','bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2','Hand-written card',3),
  ('c3333333-3333-3333-3333-333333333331','bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3','100% cotton yarn',1),
  ('c3333333-3333-3333-3333-333333333332','bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3','Gift-boxed',2),
  ('c3333333-3333-3333-3333-333333333333','bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3','Custom message tag',3),
  ('c5555555-5555-5555-5555-555555555551','bbbbbbb5-bbbb-bbbb-bbbb-bbbbbbbbbbb5','10x10 shadow box',1),
  ('c5555555-5555-5555-5555-555555555552','bbbbbbb5-bbbb-bbbb-bbbb-bbbbbbbbbbb5','Personalized couple names',2),
  ('c6666666-6666-6666-6666-666666666661','bbbbbbb6-bbbb-bbbb-bbbb-bbbbbbbbbbb6','Colorfast fabric paint',1),
  ('c6666666-6666-6666-6666-666666666662','bbbbbbb6-bbbb-bbbb-bbbb-bbbbbbbbbbb6','2.5 metre length',2),
  ('c7777777-7777-7777-7777-777777777771','bbbbbbb7-bbbb-bbbb-bbbb-bbbbbbbbbbb7','Laser-cut precision',1),
  ('c7777777-7777-7777-7777-777777777772','bbbbbbb7-bbbb-bbbb-bbbb-bbbbbbbbbbb7','Ready-to-mount',2),
  ('c8888888-8888-8888-8888-888888888881','bbbbbbb8-bbbb-bbbb-bbbb-bbbbbbbbbbb8','16x16 styled box',1),
  ('c8888888-8888-8888-8888-888888888882','bbbbbbb8-bbbb-bbbb-bbbb-bbbbbbbbbbb8','Pastel balloon palette',2),
  ('c9999999-9999-9999-9999-999999999991','bbbbbbb9-bbbb-bbbb-bbbb-bbbbbbbbbbb9','Gold foil calligraphy',1),
  ('c9999999-9999-9999-9999-999999999992','bbbbbbb9-bbbb-bbbb-bbbb-bbbbbbbbbbb9','Pressed florals',2),
  ('c9999999-9999-9999-9999-999999999993','bbbbbbb9-bbbb-bbbb-bbbb-bbbbbbbbbbb9','Inner booklet + envelope',3)
on conflict (id) do nothing;

-- ────────────────────────────────────────────────── reviews + replies (SEO) ──
insert into public.reviews (id, product_id, user_id, customer_name, rating, comment, status) values
  ('d1111111-1111-1111-1111-111111111111','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1',null,'Hina Ahmed',5.0,'Packaging felt premium and the initials were perfectly done.','published'),
  ('d1111111-1111-1111-1111-111111111112','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1',null,'Ayesha Raza',5.0,'My sister cried when she opened it. Thank you for the finishing.','published'),
  ('d2222222-2222-2222-2222-222222222222','bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2',null,'Sara Malik',4.0,'Beautiful bouquet, delivery was a little tight on time.','published'),
  ('d2222222-2222-2222-2222-222222222223','bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2',null,'Farah Noor',5.0,'Every rose was perfect. Better than fresh flowers.','published'),
  ('d3333333-3333-3333-3333-333333333333','bbbbbbb3-bbbb-bbbb-bbbb-bbbbbbbbbbb3',null,'Noor Fatima',5.0,'Very soft finishing and the hamper looked exactly like the photos.','published'),
  ('d5555555-5555-5555-5555-555555555555','bbbbbbb5-bbbb-bbbb-bbbb-bbbbbbbbbbb5',null,'Mariam Butt',5.0,'Hung it above our bed. Every guest asks about it.','published'),
  ('d6666666-6666-6666-6666-666666666666','bbbbbbb6-bbbb-bbbb-bbbb-bbbbbbbbbbb6',null,'Zara Sheikh',5.0,'The painting is so delicate in person. Worth every rupee.','published'),
  ('d7777777-7777-7777-7777-777777777777','bbbbbbb7-bbbb-bbbb-bbbb-bbbbbbbbbbb7',null,'Amna Kiyani',4.5,'Clean laser work and the walnut stain is exactly as shown.','published'),
  ('d8888888-8888-8888-8888-888888888888','bbbbbbb8-bbbb-bbbb-bbbb-bbbbbbbbbbb8',null,'Rimsha Anwar',5.0,'The reveal moment at my daughter''s party was magical.','published'),
  ('d9999999-9999-9999-9999-999999999999','bbbbbbb9-bbbb-bbbb-bbbb-bbbbbbbbbbb9',null,'Sehrish Rashid',5.0,'We will frame this after the wedding. Stunning work.','published'),
  ('d9999999-9999-9999-9999-99999999999a','bbbbbbbc-bbbb-bbbb-bbbb-bbbbbbbbbbbc',null,'Faiza Tariq',4.8,'Engraving is clean, the velvet liner is a thoughtful touch.','published'),
  ('d9999999-9999-9999-9999-99999999999b','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',null,'Iqra Shah',5.0,'Perfect little gift — I bought three.','pending'),
  ('d9999999-9999-9999-9999-99999999999c','bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2',null,'Reviewer Flagged',2.0,'Spam content blocked by moderator.','flagged')
on conflict (id) do nothing;

insert into public.review_replies (id, review_id, replied_by, reply) values
  ('e1111111-1111-1111-1111-111111111111','d1111111-1111-1111-1111-111111111111',null,'Thank you. We are glad the custom finishing felt special.'),
  ('e2222222-2222-2222-2222-222222222222','d2222222-2222-2222-2222-222222222222',null,'Apologies for the tight delivery — noted for next batch.'),
  ('e5555555-5555-5555-5555-555555555555','d5555555-5555-5555-5555-555555555555',null,'Love this. Thank you for sharing a photo with us!')
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────── payment_methods ──
insert into public.payment_methods (id, name, type, account_title, account_number, bank_name, instructions, is_active, sort_order) values
  ('f0000001-0000-0000-0000-000000000001','EasyPaisa','mobile_wallet','Kiyani Galleria','0300-1234567',null,'Send payment to the account and share screenshot in WhatsApp.',true,1),
  ('f0000001-0000-0000-0000-000000000002','JazzCash','mobile_wallet','Kiyani Galleria','0321-7654321',null,'Send payment to the account and share screenshot in WhatsApp.',true,2),
  ('f0000001-0000-0000-0000-000000000003','Meezan Bank','bank_transfer','Kiyani Galleria','01230123456789','Meezan Bank Ltd','IBAN: PK36MEZN0001230123456789',true,3),
  ('f0000001-0000-0000-0000-000000000004','Cash on Delivery','cod',null,null,null,'Pay courier on delivery.',true,4)
on conflict (id) do update set
  instructions = excluded.instructions,
  is_active = excluded.is_active;

-- ──────────────────────────────────────────────────────────────── orders ──
insert into public.orders (id, order_no, user_id, customer_name, customer_email, customer_phone, city, address, payment_status, fulfillment_status, subtotal_pkr, discount_pkr, shipping_pkr, total_pkr, notes) values
  ('f1111111-1111-1111-1111-111111111111','ORD-3201',null,'Mariam Khan','mariam@example.com','+923001112233','Karachi','12 Clifton Block 5, Karachi','paid','dispatched',6500,650,300,6150,'Gift wrap with ivory ribbon please.'),
  ('f1111111-1111-1111-1111-111111111112','ORD-3202',null,'Saba Iqbal','saba@example.com','+923333221100','Lahore','House 4, Street 11, DHA Phase 6','paid','delivered',4200,0,250,4450,'Birthday — deliver by Friday.'),
  ('f1111111-1111-1111-1111-111111111113','ORD-3203',null,'Hina Zia','hina.zia@example.com','+923451122334','Islamabad','Office 14, F-10 Markaz','pending','processing',7200,0,350,7550,'Engraving: "S & A — 15.08.2026"'),
  ('f1111111-1111-1111-1111-111111111114','ORD-3204',null,'Anum Ali','anum@example.com','+923005566778','Arifwala','Main Bazaar, Arifwala','paid','packed',9800,980,0,8820,'Pickup from studio.'),
  ('f1111111-1111-1111-1111-111111111115','ORD-3205',null,'Rabia Nasir','rabia@example.com','+923210009988','Multan','MDA Cantt, Multan','failed','cancelled',3500,0,250,3750,'Payment failed twice — follow up.'),
  ('f1111111-1111-1111-1111-111111111116','ORD-3206',null,'Zoya Farooq','zoya@example.com','+923337778899','Peshawar','University Town, Peshawar','paid','delivered',5800,580,300,5520,null)
on conflict (id) do update set
  payment_status = excluded.payment_status,
  fulfillment_status = excluded.fulfillment_status,
  notes = excluded.notes;

-- ──────────────────────────────────────────────────────────── order_items ──
insert into public.order_items (id, order_id, product_id, product_name, sku, quantity, unit_price_pkr, total_price_pkr) values
  ('01110001-0000-0000-0000-000000000001','f1111111-1111-1111-1111-111111111111','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1','Rose Letter Gift Box','CBK-201',1,6500,6500),
  ('01110002-0000-0000-0000-000000000002','f1111111-1111-1111-1111-111111111112','bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2','Blush Crochet Bouquet','CBK-202',1,4200,4200),
  ('01110003-0000-0000-0000-000000000003','f1111111-1111-1111-1111-111111111113','bbbbbbbc-bbbb-bbbb-bbbb-bbbbbbbbbbbc','Engraved Couples Keepsake Box','CBK-212',1,7200,7200),
  ('01110004-0000-0000-0000-000000000004','f1111111-1111-1111-1111-111111111114','bbbbbbb6-bbbb-bbbb-bbbb-bbbbbbbbbbb6','Hand-Painted Ivory Dupatta','CBK-206',1,9800,9800),
  ('01110005-0000-0000-0000-000000000005','f1111111-1111-1111-1111-111111111115','bbbbbbba-bbbb-bbbb-bbbb-bbbbbbbbbbba','Ramadan Table Centerpiece','CBK-210',1,3500,3500),
  ('01110006-0000-0000-0000-000000000006','f1111111-1111-1111-1111-111111111116','bbbbbbb5-bbbb-bbbb-bbbb-bbbbbbbbbbb5','Floral Shadow Box Frame','CBK-205',1,5800,5800)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────── custom_requests ──
insert into public.custom_requests (id, request_no, user_id, customer_name, customer_email, customer_phone, request_type, brief, budget_pkr, due_date, priority, status) values
  ('91111111-1111-1111-1111-111111111111','REQ-1001',null,'Hira Malik','hira@example.com','+923001234567','Wedding','Need 80 coordinated paper-craft guest favors for a nikah event in Lahore. Navy + gold palette.',45000,'2026-06-15','high','quoted'),
  ('91111111-1111-1111-1111-111111111112','REQ-1002',null,'Ammara Sultan','ammara@example.com','+923339876543','Baby Shower','Custom knitted hamper for twins — matching pastel blankets + booties.',12000,'2026-05-01','medium','in_progress'),
  ('91111111-1111-1111-1111-111111111113','REQ-1003',null,'Zainab Yusuf','zainab@example.com','+923214567890','Birthday','Balloon reveal box for 10-year-old, unicorn theme.',6500,'2026-04-28','low','new'),
  ('91111111-1111-1111-1111-111111111114','REQ-1004',null,'Farah Saeed','farah@example.com','+923011239876','Anniversary','Engraved walnut plaque with couple names + date of marriage.',7500,'2026-05-10','medium','completed'),
  ('91111111-1111-1111-1111-111111111115','REQ-1005',null,'Noor Jehan','noor@example.com','+923458765432','Eid','Bulk order 50 Ramadan centerpieces for a corporate iftar event.',120000,'2026-03-10','high','cancelled')
on conflict (id) do update set
  status = excluded.status,
  priority = excluded.priority,
  brief = excluded.brief;

-- ───────────────────────────────────────────────────── accounting_accounts ──
-- Upsert by code. Note: we reference accounts in journal_lines by a subquery
-- on `code` so this seed is resilient whether the account UUIDs came from the
-- base schema seed or from this file.
insert into public.accounting_accounts (code, name, category, description, is_active) values
  ('1300','Easypaisa Wallet','asset','Easypaisa / JazzCash cleared balances',true),
  ('4100','Custom Project Revenue','revenue','Bespoke / custom request income',true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;

-- ───────────────────────────────────────────────────────────────── invoices ──
insert into public.invoices (id, invoice_no, order_id, customer_profile_id, customer_name, customer_email, issue_date, due_date, subtotal_pkr, discount_pkr, tax_pkr, total_pkr, paid_pkr, balance_pkr, status, notes) values
  ('b1000000-0000-0000-0000-000000000001','INV-2026-001','f1111111-1111-1111-1111-111111111111',null,'Mariam Khan','mariam@example.com','2026-03-05','2026-03-19',6500,650,0,6150,6150,0,'paid','Paid via Easypaisa.'),
  ('b1000000-0000-0000-0000-000000000002','INV-2026-002','f1111111-1111-1111-1111-111111111112',null,'Saba Iqbal','saba@example.com','2026-03-10','2026-03-24',4200,0,0,4450,4450,0,'paid',null),
  ('b1000000-0000-0000-0000-000000000003','INV-2026-003','f1111111-1111-1111-1111-111111111113',null,'Hina Zia','hina.zia@example.com','2026-03-18','2026-04-01',7200,0,0,7550,0,7550,'issued','Awaiting payment confirmation.'),
  ('b1000000-0000-0000-0000-000000000004','INV-2026-004','f1111111-1111-1111-1111-111111111114',null,'Anum Ali','anum@example.com','2026-03-22','2026-04-05',9800,980,0,8820,4000,4820,'partially_paid','Partial payment received via bank transfer.'),
  ('b1000000-0000-0000-0000-000000000005','INV-2026-005','f1111111-1111-1111-1111-111111111116',null,'Zoya Farooq','zoya@example.com','2026-04-01','2026-04-15',5800,580,0,5520,5520,0,'paid',null)
on conflict (id) do update set
  status = excluded.status,
  paid_pkr = excluded.paid_pkr,
  balance_pkr = excluded.balance_pkr,
  notes = excluded.notes;

-- ────────────────────────────────────────────────────────────── invoice_lines ──
insert into public.invoice_lines (id, invoice_id, product_id, description, quantity, unit_price_pkr, line_total_pkr, sort_order) values
  ('c1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001','bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1','Rose Letter Gift Box (made-to-order, initials "MK")',1,6500,6500,1),
  ('c1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000002','bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2','Blush Crochet Bouquet',1,4200,4200,1),
  ('c1000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000003','bbbbbbbc-bbbb-bbbb-bbbb-bbbbbbbbbbbc','Engraved Couples Keepsake Box',1,7200,7200,1),
  ('c1000000-0000-0000-0000-000000000004','b1000000-0000-0000-0000-000000000004','bbbbbbb6-bbbb-bbbb-bbbb-bbbbbbbbbbb6','Hand-Painted Ivory Dupatta',1,9800,9800,1),
  ('c1000000-0000-0000-0000-000000000005','b1000000-0000-0000-0000-000000000005','bbbbbbb5-bbbb-bbbb-bbbb-bbbbbbbbbbb5','Floral Shadow Box Frame',1,5800,5800,1)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────── journal_entries ──
insert into public.journal_entries (id, journal_no, entry_date, reference_type, reference_id, memo, status) values
  ('d2000000-0000-0000-0000-000000000001','JE-2026-001','2026-03-05','invoice','b1000000-0000-0000-0000-000000000001','Payment received: INV-2026-001','posted'),
  ('d2000000-0000-0000-0000-000000000002','JE-2026-002','2026-03-10','invoice','b1000000-0000-0000-0000-000000000002','Payment received: INV-2026-002','posted'),
  ('d2000000-0000-0000-0000-000000000003','JE-2026-003','2026-03-18','invoice','b1000000-0000-0000-0000-000000000003','Invoice issued: INV-2026-003','posted'),
  ('d2000000-0000-0000-0000-000000000004','JE-2026-004','2026-03-22','invoice','b1000000-0000-0000-0000-000000000004','Invoice + partial payment: INV-2026-004','posted'),
  ('d2000000-0000-0000-0000-000000000005','JE-2026-005','2026-03-25','purchase',null,'Yarn + paper stock replenishment','posted'),
  ('d2000000-0000-0000-0000-000000000006','JE-2026-006','2026-04-01','invoice','b1000000-0000-0000-0000-000000000005','Payment received: INV-2026-005','draft')
on conflict (id) do update set
  status = excluded.status,
  memo = excluded.memo;

-- Balanced journal lines (debits = credits for each entry). Accounts resolved
-- by `code` subquery so seed works regardless of how account UUIDs were minted.
insert into public.journal_lines (id, journal_entry_id, account_id, description, debit_pkr, credit_pkr, line_order)
select id, journal_entry_id, (select id from public.accounting_accounts where code = account_code), description, debit_pkr, credit_pkr, line_order
from (values
  -- JE-001 — Easypaisa in, sale revenue
  ('e3000000-0000-0000-0000-000000000001'::uuid,'d2000000-0000-0000-0000-000000000001'::uuid,'1300','Easypaisa receipt: INV-2026-001',6150::numeric,0::numeric,1),
  ('e3000000-0000-0000-0000-000000000002'::uuid,'d2000000-0000-0000-0000-000000000001'::uuid,'4000','Sales revenue: Rose Letter Gift Box',0::numeric,6150::numeric,2),
  -- JE-002
  ('e3000000-0000-0000-0000-000000000003'::uuid,'d2000000-0000-0000-0000-000000000002'::uuid,'1300','Easypaisa receipt: INV-2026-002',4450::numeric,0::numeric,1),
  ('e3000000-0000-0000-0000-000000000004'::uuid,'d2000000-0000-0000-0000-000000000002'::uuid,'4000','Sales revenue: Blush Crochet Bouquet',0::numeric,4450::numeric,2),
  -- JE-003 — AR created
  ('e3000000-0000-0000-0000-000000000005'::uuid,'d2000000-0000-0000-0000-000000000003'::uuid,'1100','AR: INV-2026-003',7550::numeric,0::numeric,1),
  ('e3000000-0000-0000-0000-000000000006'::uuid,'d2000000-0000-0000-0000-000000000003'::uuid,'4000','Sales revenue: Keepsake Box',0::numeric,7550::numeric,2),
  -- JE-004 — partial
  ('e3000000-0000-0000-0000-000000000007'::uuid,'d2000000-0000-0000-0000-000000000004'::uuid,'1000','Cash receipt (partial): INV-2026-004',4000::numeric,0::numeric,1),
  ('e3000000-0000-0000-0000-000000000008'::uuid,'d2000000-0000-0000-0000-000000000004'::uuid,'1100','Outstanding AR: INV-2026-004',4820::numeric,0::numeric,2),
  ('e3000000-0000-0000-0000-000000000009'::uuid,'d2000000-0000-0000-0000-000000000004'::uuid,'4000','Sales revenue: Dupatta',0::numeric,8820::numeric,3),
  -- JE-005 — materials expense
  ('e3000000-0000-0000-0000-00000000000a'::uuid,'d2000000-0000-0000-0000-000000000005'::uuid,'6000','Yarn + paper supplies',12500::numeric,0::numeric,1),
  ('e3000000-0000-0000-0000-00000000000b'::uuid,'d2000000-0000-0000-0000-000000000005'::uuid,'1000','Cash paid to vendor',0::numeric,12500::numeric,2),
  -- JE-006 draft
  ('e3000000-0000-0000-0000-00000000000c'::uuid,'d2000000-0000-0000-0000-000000000006'::uuid,'1300','Easypaisa receipt: INV-2026-005',5520::numeric,0::numeric,1),
  ('e3000000-0000-0000-0000-00000000000d'::uuid,'d2000000-0000-0000-0000-000000000006'::uuid,'4000','Sales revenue: Shadow Box',0::numeric,5520::numeric,2)
) as t(id, journal_entry_id, account_code, description, debit_pkr, credit_pkr, line_order)
on conflict (id) do nothing;

-- ─────────────────────────────────── brand_settings (storefront-facing text) ──
-- Keep pre-existing announcements, add/enrich SEO globals with realistic values.
insert into public.brand_settings (key, value) values
  ('announcement_bar',        '{"text":"Free shipping on orders over PKR 5,000 — handmade in Arifwala"}'::jsonb),
  ('primary_cta_label',       '{"text":"Shop curated gifts"}'::jsonb),
  ('review_request_message',  '{"text":"Tell us how your order felt when it arrived"}'::jsonb),
  ('brand_voice',             '{"text":"Soft, polished, handmade, premium"}'::jsonb),
  ('contact_email',           '{"value":"hello@kiyanigalleria.com"}'::jsonb),
  ('contact_phone',           '{"value":"+92-300-1234567"}'::jsonb),
  ('contact_whatsapp',        '{"value":"+92-300-1234567"}'::jsonb),
  ('contact_address',         '{"value":"Main Bazaar, Arifwala, Punjab 57450, Pakistan"}'::jsonb),
  ('deal_of_the_day_timer',   '{"ends_at":"2026-04-30T23:59:59Z"}'::jsonb)
on conflict (key) do update set
  value = excluded.value;

-- Enrich seo_* rows with real social + organization data
update public.brand_settings set value = jsonb_set(
  jsonb_set(value, '{site_name}', '"Kiyani Galleria"'),
  '{canonical_domain}', '"https://www.kiyanigalleria.com"'
) where key = 'seo_global';

update public.brand_settings set value = jsonb_build_object(
  'twitter_handle', 'kiyanigalleria',
  'twitter_card_type', 'summary_large_image',
  'facebook_app_id', null,
  'instagram_url', 'https://www.instagram.com/kiyanigalleria',
  'facebook_url', 'https://www.facebook.com/kiyanigalleria',
  'pinterest_url', 'https://www.pinterest.com/kiyanigalleria',
  'tiktok_url', null,
  'youtube_url', null,
  'whatsapp_number', '923001234567'
) where key = 'seo_social';

update public.brand_settings set value = jsonb_build_object(
  'legal_name', 'Kiyani Galleria',
  'founding_date', '2022-03-01',
  'founders', jsonb_build_array('Areeba Kiyani', 'Amna Kiyani'),
  'address', jsonb_build_object(
    'street','Main Bazaar',
    'city','Arifwala',
    'region','Punjab',
    'postal','57450',
    'country','PK'
  ),
  'email', 'hello@kiyanigalleria.com',
  'phone', '+92-300-1234567',
  'logo_url', null,
  'same_as', jsonb_build_array(
    'https://www.instagram.com/kiyanigalleria',
    'https://www.facebook.com/kiyanigalleria'
  )
) where key = 'seo_organization';

commit;
