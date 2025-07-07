// components/AvatarFallback.jsx
export default function AvatarFallback({ initials = '?' }) {
  return (
    <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold">
      {initials}
    </div>
  );
}
