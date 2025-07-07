// components/Footer.js
export default function Footer() {
  return (
    <footer className="bg-gray-100 mt-12">
      <div className="max-w-4xl mx-auto text-center px-4 py-4 text-gray-600 text-sm">
        © {new Date().getFullYear()} VybeLocal. All rights reserved.
      </div>
    </footer>
  );
}