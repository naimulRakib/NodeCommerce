import SellerForm from '@/components/seller/SellerForm';

export const metadata = {
  title: 'Seller Registration | NodeCommerce',
  description: 'Register your store on NodeCommerce',
};

export default function SellerPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Become a Seller
          </h1>
          <p className="text-gray-600 text-lg">
            Join thousands of sellers on NodeCommerce. Register in 3 easy steps.
          </p>
        </div>

        <SellerForm />
      </div>
    </div>
  );
}
