"use client";
import React, { useState } from "react";
import Link from "next/link";
import FlagGroupClient from "./FlagGroupClient";

export default function AdminFlagsClient({ grouped, statusOptions, statusCounts, activeStatus }) {
  const [refreshKey, setRefreshKey] = useState(0);
  function handleStatusChange() {
    setRefreshKey((k) => k + 1);
    location.reload();
  }
  return (
    <>
      <div className="space-y-4">
        {Object.keys(grouped).length === 0 && (
          <div className="p-4 text-center text-gray-500">No flags found.</div>
        )}
        {Object.entries(grouped).map(([userId, { profile, flags }]) => (
          <FlagGroupClient key={userId + refreshKey} profile={profile} flags={flags} onStatusChange={handleStatusChange} />
        ))}
      </div>
    </>
  );
} 