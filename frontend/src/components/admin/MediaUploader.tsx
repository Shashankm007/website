'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Box, ImagePlus, Link2, Loader2, Trash2, UploadCloud, Video } from 'lucide-react';
import { api } from '@/lib/client-api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/** A media entry collected by the uploader. Matches the product media input shape. */
export interface MediaEntry {
  type: 'IMAGE' | 'VIDEO' | 'MODEL_3D';
  url: string;
  objectKey?: string;
}

/** Renderable 3D model formats supported by the storefront viewer. */
const MODEL_EXTS = ['.stl', '.obj'];

/** True if a file name / URL points at a 3D model the viewer can render. */
function isModelName(name: string): boolean {
  const clean = name.split(/[?#]/)[0].toLowerCase();
  return MODEL_EXTS.some((ext) => clean.endsWith(ext));
}

interface PresignResponse {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
}

interface MediaUploaderProps {
  value: MediaEntry[];
  onChange: (next: MediaEntry[]) => void;
}

/**
 * Uploads product images via presigned PUT URLs (or accepts a pasted URL).
 * Shows thumbnails with remove + reorder-by-position controls. Position is
 * implied by array order, which the parent persists as `position` on submit.
 */
export function MediaUploader({ value, onChange }: MediaUploaderProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');

  const uploadOne = async (file: File): Promise<MediaEntry> => {
    const isModel = isModelName(file.name);
    const isVideo = !isModel && file.type.startsWith('video/');
    const uploadKind = isModel ? 'model' : isVideo ? 'video' : 'image';
    const { data } = await api.post<PresignResponse>('/uploads/presign', {
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      kind: uploadKind,
    });
    // Presigned PUT — send the raw file with its content type and NO auth header.
    const put = await fetch(data.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });
    if (!put.ok) throw new Error(`Upload failed for ${file.name}`);
    const type: MediaEntry['type'] = isModel ? 'MODEL_3D' : isVideo ? 'VIDEO' : 'IMAGE';
    return { type, url: data.publicUrl, objectKey: data.objectKey };
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const media = Array.from(files).filter(
      (f) => f.type.startsWith('image/') || f.type.startsWith('video/') || isModelName(f.name),
    );
    if (media.length === 0) {
      toast.error('Please choose image, video, or 3D model (.stl/.obj) files');
      return;
    }
    setUploading(true);
    try {
      const uploaded: MediaEntry[] = [];
      for (const file of media) {
        uploaded.push(await uploadOne(file));
      }
      onChange([...value, ...uploaded]);
      toast.success(`Uploaded ${uploaded.length} file${uploaded.length > 1 ? 's' : ''}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const addUrl = () => {
    const url = urlDraft.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      toast.error('Enter a valid http(s) image URL');
      return;
    }
    if (value.some((m) => m.url === url)) {
      toast.error('That media is already added');
      return;
    }
    const type: MediaEntry['type'] = isModelName(url) ? 'MODEL_3D' : 'IMAGE';
    onChange([...value, { type, url }]);
    setUrlDraft('');
  };

  const removeAt = (index: number) => onChange(value.filter((_, i) => i !== index));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInput}
          type="file"
          accept="image/*,video/*,.stl,.obj,model/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {uploading ? 'Uploading…' : 'Upload images, videos & 3D models'}
        </Button>
        <div className="flex flex-1 items-end gap-2">
          <Input
            placeholder="…or paste an image / .stl URL"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addUrl();
              }
            }}
          />
          <Button type="button" variant="secondary" onClick={addUrl}>
            <Link2 className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {value.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-slate-400">
          <ImagePlus className="mb-2 h-8 w-8" />
          <p className="text-sm">No media yet. Upload images, videos, or a 3D model (.stl/.obj), or paste a URL.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {value.map((m, i) => (
            <li key={`${m.url}-${i}`} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="relative aspect-square bg-slate-100">
                {m.type === 'MODEL_3D' ? (
                  <>
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-400">
                      <Box className="h-8 w-8" />
                      <span className="px-2 text-center text-[10px] font-medium text-slate-500 line-clamp-1">
                        {m.url.split('/').pop()?.split(/[?#]/)[0] ?? '3D model'}
                      </span>
                    </div>
                    <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                      <Box className="h-3 w-3" />
                      3D
                    </span>
                  </>
                ) : m.type === 'VIDEO' ? (
                  <>
                    <video
                      src={m.url}
                      muted
                      playsInline
                      preload="metadata"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                      <Video className="h-3 w-3" />
                      Video
                    </span>
                  </>
                ) : (
                  <Image src={m.url} alt={`Media ${i + 1}`} fill sizes="200px" className="object-cover" />
                )}
                {i === 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                    Primary
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 p-1.5">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                    aria-label="Move earlier"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === value.length - 1}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                    aria-label="Move later"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50"
                  aria-label="Remove media"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
