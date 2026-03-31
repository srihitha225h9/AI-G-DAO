import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    // Upload to Cloudinary
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET

    if (!cloudName || !uploadPreset) {
      return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 500 })
    }

    const upload = new FormData()
    upload.append('file', file)
    upload.append('upload_preset', uploadPreset)
    upload.append('folder', 'econexus-proofs')

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: 'POST',
      body: upload,
    })

    if (!res.ok) {
      const err = await res.json()
      return NextResponse.json({ error: err.error?.message || 'Upload failed' }, { status: 500 })
    }

    const data = await res.json()
    return NextResponse.json({
      url: data.secure_url,
      type: data.resource_type,
      format: data.format,
      name: file.name,
      size: data.bytes,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
