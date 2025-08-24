import { Check } from "lucide-react";

export default function TrustedHostBadge({ is_trusted }) {
  if (!is_trusted) {
    return <span className="text-xs text-gray-400">Host</span>;
  }
  
  return (
    <span className="flex items-center gap-1 text-xs text-green-600">
      <Check className="w-3 h-3" strokeWidth={3} />
      Verified Host
    </span>
  );
} 