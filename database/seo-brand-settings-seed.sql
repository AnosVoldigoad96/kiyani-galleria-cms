-- Seed rows for global SEO configuration stored in public.brand_settings (key/jsonb).
-- Idempotent: INSERT ... ON CONFLICT DO NOTHING.
-- Admin can edit values via the /cms/seo UI after seeding.
--
-- Keys are whitelisted for public (anonymous) SELECT — see seo-brand-settings-public-select.sql.

INSERT INTO public.brand_settings (key, value)
VALUES
  ('seo_global', jsonb_build_object(
    'site_name',          'Kiyani Galleria',
    'site_tagline',       'Handmade Gifts from the Heart',
    'default_title',      'Kiyani Galleria | Handmade Gifts from the Heart',
    'title_template',     '%s | Kiyani Galleria',
    'default_description','Handmade gifts crafted by sisters in Arifwala — paper crafts, hand-painted art, wooden keepsakes, balloon gifts, crochet, knitted sets & decorated nikaah namas.',
    'default_keywords',   ARRAY['Kiyani Galleria','handmade gifts Pakistan','paper crafts','hand painted gifts','wooden keepsakes','balloon packed gifts','crochet gifts','knitted gifts','nikaah nama decoration','wedding gifts Pakistan','Eid gifts','baby shower gifts','Arifwala']::text[],
    'canonical_domain',   'https://www.kiyanigalleria.com',
    'default_locale',     'en',
    'alternate_locales',  ARRAY[]::text[],
    'default_og_image_url', NULL,
    'favicon_url',        '/favicon.ico'
  )),

  ('seo_social', jsonb_build_object(
    'twitter_handle',     NULL,
    'twitter_card_type',  'summary_large_image',
    'facebook_app_id',    NULL,
    'instagram_url',      NULL,
    'facebook_url',       NULL,
    'pinterest_url',      NULL,
    'tiktok_url',         NULL,
    'youtube_url',        NULL,
    'whatsapp_number',    NULL
  )),

  ('seo_robots', jsonb_build_object(
    'mode',               'allow',
    'disallow_paths',     ARRAY['/cms','/api','/account','/cart','/checkout','/reset-password','/verify-email','/favorites']::text[],
    'allow_paths',        ARRAY[]::text[],
    'crawl_delay',        NULL,
    'sitemap_enabled',    true
  )),

  ('seo_verification', jsonb_build_object(
    'google',             NULL,
    'bing',               NULL,
    'yandex',             NULL,
    'pinterest',          NULL,
    'facebook',           NULL
  )),

  ('seo_sitemap', jsonb_build_object(
    'include_products',        true,
    'include_categories',      true,
    'include_subcategories',   true,
    'include_static',          true,
    'default_change_freq',     'weekly',
    'default_priority',        0.7,
    'custom_urls',             '[]'::jsonb
  )),

  ('seo_organization', jsonb_build_object(
    'legal_name',    'Kiyani Galleria',
    'founding_date', NULL,
    'founders',      ARRAY[]::text[],
    'address', jsonb_build_object(
      'street',     NULL,
      'city',       'Arifwala',
      'region',     'Punjab',
      'postal',     NULL,
      'country',    'PK'
    ),
    'email',    NULL,
    'phone',    NULL,
    'logo_url', NULL,
    'same_as',  ARRAY[]::text[]
  ))
ON CONFLICT (key) DO NOTHING;
