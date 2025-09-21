'use client';

import React, { useState } from 'react';

export default function UploadPage() {
  const [formData, setFormData] = useState({
    type: 'wallpaper',
    title: '',
    caption: '',
    shloka: '',
    meaning: '',
    ratio: '16:9',
    palette: '',
    style: ''
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setFile(selectedFile || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      alert('Please select a file');
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      // Step 1: Get upload URL
      const fileExt = file.name.split('.').pop();
      const uploadUrlResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/upload-url`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add Authorization header with Cognito ID token
        },
        body: JSON.stringify({
          contentType: file.type,
          fileExt,
          type: formData.type
        })
      });

      if (!uploadUrlResponse.ok) {
        throw new Error(`Failed to get upload URL: ${uploadUrlResponse.statusText}`);
      }

      const { uploadUrl, key } = await uploadUrlResponse.json();

      // Step 2: Upload file to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
      }

      // Step 3: Save metadata to catalog
      const catalogResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/catalog`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add Authorization header with Cognito ID token
        },
        body: JSON.stringify({
          ...formData,
          fileKey: key
        })
      });

      if (!catalogResponse.ok) {
        throw new Error(`Failed to save catalog: ${catalogResponse.statusText}`);
      }

      const catalogResult = await catalogResponse.json();

      setResult({
        success: true,
        key,
        catalogItem: catalogResult,
        cdnUrl: `${process.env.NEXT_PUBLIC_ASSETS_CDN_URL}/${key}`
      });

      // Reset form
      setFormData({
        type: 'wallpaper',
        title: '',
        caption: '',
        shloka: '',
        meaning: '',
        ratio: '16:9',
        palette: '',
        style: ''
      });
      setFile(null);

    } catch (error) {
      console.error('Upload error:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Upload Content</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700">
            Content Type
          </label>
          <select
            id="type"
            name="type"
            value={formData.type}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="wallpaper">Wallpaper</option>
            <option value="music">Music</option>
          </select>
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Title *
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="caption" className="block text-sm font-medium text-gray-700">
            Caption
          </label>
          <textarea
            id="caption"
            name="caption"
            value={formData.caption}
            onChange={handleInputChange}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="shloka" className="block text-sm font-medium text-gray-700">
            Shloka
          </label>
          <textarea
            id="shloka"
            name="shloka"
            value={formData.shloka}
            onChange={handleInputChange}
            rows={2}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="meaning" className="block text-sm font-medium text-gray-700">
            Meaning
          </label>
          <textarea
            id="meaning"
            name="meaning"
            value={formData.meaning}
            onChange={handleInputChange}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="ratio" className="block text-sm font-medium text-gray-700">
              Aspect Ratio
            </label>
            <input
              type="text"
              id="ratio"
              name="ratio"
              value={formData.ratio}
              onChange={handleInputChange}
              placeholder="16:9"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="style" className="block text-sm font-medium text-gray-700">
              Style
            </label>
            <input
              type="text"
              id="style"
              name="style"
              value={formData.style}
              onChange={handleInputChange}
              placeholder="devotional, nature, etc."
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="file" className="block text-sm font-medium text-gray-700">
            File *
          </label>
          <input
            type="file"
            id="file"
            onChange={handleFileChange}
            accept={formData.type === 'wallpaper' ? 'image/*' : 'audio/*'}
            required
            className="mt-1 block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-indigo-50 file:text-indigo-700
              hover:file:bg-indigo-100"
          />
        </div>

        <div>
          <button
            type="submit"
            disabled={uploading}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              uploading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
            }`}
          >
            {uploading ? 'Uploading...' : 'Upload Content'}
          </button>
        </div>
      </form>

      {result && (
        <div className={`mt-8 p-4 rounded-md ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          {result.success ? (
            <div>
              <h3 className="text-lg font-medium text-green-800 mb-2">Upload Successful!</h3>
              <p className="text-sm text-green-700 mb-2">File Key: {result.key}</p>
              <p className="text-sm text-green-700 mb-2">CDN URL: {result.cdnUrl}</p>
              <div className="mt-4 p-3 bg-white rounded border">
                <h4 className="font-medium text-gray-900 mb-2">Catalog Item:</h4>
                <pre className="text-xs text-gray-600 overflow-auto">
                  {JSON.stringify(result.catalogItem, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-medium text-red-800 mb-2">Upload Failed</h3>
              <p className="text-sm text-red-700">{result.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
