// components/settings/ProfileImageUploader.jsx
"use client";
import { useState } from 'react';
import Cropper from 'react-easy-crop';
import imageCompression from 'browser-image-compression';
import { getCroppedImg } from '@/utils/cropToBlob';
import { createSupabaseBrowser } from '@/utils/supabase/client';

export default function ProfileImageUploader({ userId, currentUrl, onDone }) {
  const supabase = createSupabaseBrowser();
  const [step, setStep] = useState('pick'); // pick | crop | uploading
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  function handleChoose(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!['image/jpeg', 'image/png'].includes(f.type)) {
      alert('Please choose a JPG or PNG image');
      return;
    }
    if (f.size > 10_000_000) {
      alert('Image must be smaller than 10 MB');
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStep('crop');
  }

  async function handleSave(_, areaPixels) {
    setStep('uploading');
    try {
      const blob = await getCroppedImg(preview, areaPixels);
      const compressed = await imageCompression(blob, {
        maxSizeMB: 2,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      });
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage
        .from('profile-images')
        .upload(path, compressed, {
          upsert: true,
          contentType: 'image/jpeg',
        });
      if (error) throw error;
      onDone(path);
    } catch (err) {
      alert(err.message || 'Upload failed');
      setStep('pick');
    }
  }

  if (step === 'pick') {
    return (
      <div className="space-y-2">
        <img src={currentUrl} className="w-24 h-24 rounded-full object-cover border" />
        <input type="file" accept="image/*" onChange={handleChoose} />
        <p className="text-xs text-gray-500">jpg / png • max 2 MB • square</p>
      </div>
    );
  }

  if (step === 'crop') {
    return (
      <div className="space-y-2">
        <div className="relative w-full h-64 bg-black">
          <Cropper
            image={preview}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
          />
        </div>
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        />
        <div className="flex gap-2">
          <button className="btn primary" onClick={handleSave}>
            Save Avatar
          </button>
          <button className="btn" onClick={() => setStep('pick')}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return <p className="text-sm">Uploading…</p>;
} 