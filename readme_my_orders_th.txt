PINK SHOP Guest Checkout + My Orders
- Uses original Supabase RPC place_order_with_variants unchanged.
- Redirects only after RPC succeeds.
- Local device history is not synced, and status is not live.
- Test on Netlify: place one order, confirm it exists in admin, then check My Orders.
- Do not upload SQL or change RLS for this version.
