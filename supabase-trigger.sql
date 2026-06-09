-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_deleted_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete from profiles (Cascade to seller_products, orders)
  DELETE FROM public.profiles WHERE id = OLD.id;
  
  -- Delete from buyer_profiles (Cascade to orders, cart_items, behaviours)
  DELETE FROM public.buyer_profiles WHERE id = OLD.id;
  
  -- Delete from local_resellers
  DELETE FROM public.local_resellers WHERE id = OLD.id;
  
  -- Delete from upazilla_resellers
  DELETE FROM public.upazilla_resellers WHERE id = OLD.id;
  
  -- Delete from district_resellers
  DELETE FROM public.district_resellers WHERE id = OLD.id;
  
  -- Delete from city_resellers
  DELETE FROM public.city_resellers WHERE id = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach the trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_deleted_user();
