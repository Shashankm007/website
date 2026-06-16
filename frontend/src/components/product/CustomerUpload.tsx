'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { FileBox, ImageIcon, UploadCloud, X } from 'lucide-react';
import type { CustomUpload, CustomizationType, PresignResponse } from '@/types';
import { api } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/Feedback';

type UploadKind = Extract<CustomizationType, 'STL_UPLOAD' | 'PHOTO_UPLOAD'>;

const PHOTO_MAX_BYTES = 15 * 1024 * 1024; // 15MB
const STL_MAX_BYTES = 100 * 1024 * 1024; // 100MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function CustomerUpload({
  kind,
  value,
  onChange,
}: {
  kind: UploadKind;
  value: CustomUpload | null;
  onChange: (u: CustomUpload | null) => void;
}) {
  const isPhoto = kind === 'PHOTO_UPLOAD';
  const accept = isPhoto ? 'image/*' : '.stl';
  const uploadKind = isPhoto ? 'photo' : 'custom';
  const maxBytes = isPhoto ? PHOTO_MAX_BYTES : STL_MAX_BYTES;

  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (file: File): boolean => {
    if (isPhoto) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please choose an image file.');
        return false;
      }
    } else if (!file.name.toLowerCase().endsWith('.stl')) {
      toast.error('Please choose a .stl file.');
      return false;
    }
    if (file.size > maxBytes) {
      toast.error(`File is too large. Maximum size is ${formatBytes(maxBytes)}.`);
      return false;
    }
    return true;
  };

  const handleFile = async (file: File) => {
    if (uploading) return;
    if (!validate(file)) return;

    setUploading(true);
    try {
      const contentType = file.type || (isPhoto ? 'image/*' : 'application/octet-stream');

      const { data: presign } = await api.post<PresignResponse>('/uploads/presign', {
        fileName: file.name,
        contentType,
        kind: uploadKind,
      });

      const putRes = await fetch(presign.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!putRes.ok) {
        throw new Error('upload-failed');
      }

      const { data: rec } = await api.post<CustomUpload>('/uploads/custom', {
        fileName: file.name,
        objectKey: presign.objectKey,
        sizeBytes: file.size,
      });

      onChange(rec);
      toast.success('File uploaded');
    } catch (err) {
      if (err instanceof Error && err.message === 'upload-failed') {
        toast.error('Could not upload file. Please try again.');
      } else {
        toast.error(err instanceof Error ? err.message : 'Could not upload file. Please try again.');
      }
    } finally {
      setUploading(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so selecting the same file again re-triggers change.
    e.target.value = '';
    if (file) void handleFile(file);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const remove = () => {
    if (uploading) return;
    onChange(null);
  };

  // ---- Preview of an existing upload --------------------------------------
  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-card">
        {isPhoto ? (
          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            <Image src={value.url} alt={value.fileName} fill sizes="64px" className="object-cover" />
          </div>
        ) : (
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-brand-600">
            <FileBox className="h-7 w-7" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800" title={value.fileName}>
            {value.fileName}
          </p>
          <p className="text-xs text-slate-500">{formatBytes(value.sizeBytes)}</p>
        </div>
        <button
          type="button"
          onClick={remove}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-rose-600"
          aria-label="Remove uploaded file"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // ---- Drop zone / file picker --------------------------------------------
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!uploading) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={uploading ? (e) => e.preventDefault() : onDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition',
        uploading
          ? 'cursor-default border-slate-200 bg-slate-50'
          : 'cursor-pointer border-slate-300 bg-white hover:border-brand-400 hover:bg-brand-50/40',
        dragging && 'border-brand-500 bg-brand-50',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onInputChange}
        disabled={uploading}
      />
      {uploading ? (
        <>
          <Spinner className="h-6 w-6" />
          <p className="text-sm font-medium text-slate-600">Uploading…</p>
        </>
      ) : (
        <>
          <div className="text-brand-600">
            {isPhoto ? <ImageIcon className="h-8 w-8" /> : <UploadCloud className="h-8 w-8" />}
          </div>
          <p className="text-sm font-medium text-slate-700">
            {isPhoto ? 'Drop a photo here or click to browse' : 'Drop your .stl file here or click to browse'}
          </p>
          <p className="text-xs text-slate-400">
            {isPhoto ? 'JPG, PNG up to 15 MB' : 'STL files up to 100 MB'}
          </p>
        </>
      )}
    </div>
  );
}
