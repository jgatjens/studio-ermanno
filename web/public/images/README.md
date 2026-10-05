# Website photographs

Three photographs were supplied by the user through the mobile app during Phase 10 implementation, in response to the request for approved website photography. Their supplied use is treated as authorization for this website; ownership/licensing has not been independently verified. Confirm publication rights before deployment.

- `village-street-*`: Photo 1, street and mountainside.
- `studio-exterior-*`: Photo 2, hair-studio storefront and surrounding buildings; also used in the Home hero.
- `street-detail-*`: Photo 3, scooter, planters and street.

No location, address, haircut result or business identity is inferred from these photographs. Captions describe only visible content. The database still contains development branding/contact fixtures.

Each source JPEG was EXIF-oriented, resized to 480×640 and 960×1280 and encoded as WebP quality 80 using the bundled Pillow runtime. EXIF/location metadata is not included. No new application dependency or runtime image service is required. Unmodified originals remain in the chat upload attachment, not in the public site.

Alt text, captions, dimensions and responsive sources are defined in `web/src/public/content.ts`. Keep paths in that manifest synchronized with these files. Below-fold images are lazy loaded; the hero loads eagerly. Empty manifests retain a gallery unavailable state.

Location clarification: the user confirmed the business is in Grigno, Trento. The configured public Business placeholder address was updated to `Grigno, Trento, Italia` and verified through `/public/business`. This is a municipality-level location; the exact street address is still pending. Existing directions links currently lead to this general location. The location comes from the user, not an inference from photographs. No other business fields were changed.

Street-address clarification: the user supplied Via Vittorio Emanuele 114, postal code 38055. The configured public Business address is now `Via Vittorio Emanuele 114, 38055 Grigno (TN), Italia`, verified through `/public/business`. This supersedes the municipality-only location above; the website contact section and generated directions link use the full address. No other Business fields were changed.

`salon-tools-960.jpg`: AI-generated decorative scissors/comb photograph based on the user's contact-strip reference on 5 October 2026. Used only in the availability contact section; it does not depict the actual salon. Generated through the built-in imagegen tool and resized for the website.

`salon-chair-600.jpg` and `salon-chair-1200.jpg`: responsive versions of an AI-generated decorative black-leather salon-chair image based on the user's original full-page availability reference, 5 October 2026. Used only in the availability hero, not the Home hero or business gallery. Not a photograph of the actual business.

### Homepage hero

`home-haircut-1600.jpg` and `home-haircut-800.jpg` are responsive versions of an
AI-generated decorative haircut scene inspired by the homepage reference supplied
in chat. This is illustrative imagery, not a photograph of the actual salon or its
customers. The Studio introduction reuses the existing decorative salon-chair asset.
