'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImagePlus, Trash2, UploadCloud } from 'lucide-react';
import { api } from '@/lib/client-api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface PresignResponse {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
}

/**
 * Single-image picker: upload a file via a presigned PUT (S3/R2) or paste a URL.
 * Stores/returns the public image URL. Used for category tiles, etc.
 */
export function ImageUploadField({
  value,
  onChange,
  label = 'Image',
}: {
  value?: string | null;
  onChange: (url: string) => void;
  label?: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
    }
    setUploading(true);
    try {
      const { data } = await api.post<PresignResponse>('/uploads/presign', {
        fileName: file.name,
        contentType: file.type,
        kind: 'image',
      });
      const put = await fetch(data.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (!put.ok) throw new Error('Upload failed — check your storage (S3/R2) configuration.');
      onChange(data.publicUrl);
      toast.success('Image uploaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const applyUrl = () => {
    const u = urlDraft.trim();
    if (!/^https?:\/\//i.test(u)) {
      toast.error('Enter a valid http(s) image URL');
      return;
    }
    onChange(u);
    setUrlDraft('');
  };

  return (
    <div>
      <span className="label-base">{label}</span>
      <div className="flex items-start gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          {value ? (
            // Arbitrary external hosts → use a plain <img> (no next/image domain allowlist).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Category tile preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-300">
              <ImagePlus className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" loading={uploading} onClick={() => fileInput.current?.click()}>
              <UploadCloud className="h-4 w-4" /> Upload image
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" className="text-rose-600" onClick={() => onChange('')}>
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            )}
          </div>
          <div className="flex items-end gap-2">
            <Input
              placeholder="…or paste an image URL"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyUrl();
                }
              }}
            />
            <Button type="button" variant="secondary" size="sm" onClick={applyUrl}>
              Use
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
