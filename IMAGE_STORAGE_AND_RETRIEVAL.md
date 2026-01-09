# Image Storage and Retrieval Guide

## Where Images Are Stored

### Physical Storage
- **Location**: `server/uploads/` directory
- **Naming**: Files are stored with unique filenames (timestamp + random string)
- **Format**: Any image format (jpg, png, gif, etc.)

### Database Storage
Images are stored in two places:

1. **`failed_item_images` table**:
   - Stores metadata for all uploaded images from failed checklist items
   - Fields: `id`, `task_id`, `item_id`, `section_id`, `image_path`, `image_filename`, `comment`, `uploaded_at`
   - `image_path`: Format is `/uploads/filename.jpg`

2. **`cm_letters.images` JSONB column**:
   - Stores image references linked to CM letters when a task fails
   - Format: Array of objects with `{ path, filename, item_id, section_id, comment }`
   - Example: `[{"path": "/uploads/1234567890-abc.jpg", "filename": "original.jpg", "comment": "Broken component"}]`

## How Images Are Retrieved

### 1. Upload Process
When a technician uploads an image for a failed item:
- Image is saved to `server/uploads/` folder
- Metadata is saved to `failed_item_images` table
- Path format: `/uploads/filename.jpg`

### 2. Linking to CM Letters
When a PM task fails:
- System creates a CM letter automatically
- Images from the failed task are linked to the CM letter
- Images are stored in `cm_letters.images` JSONB field

### 3. Displaying in CM Letters
The CM Letters component:
- Fetches CM letter details via `GET /api/cm-letters/:id`
- Parses the `images` JSONB field
- Constructs image URLs using: `${apiBase}/uploads/${filename}`
- Displays images under "Issue Description" section

## Image URL Construction

### Server-Side Serving
- Static files served via: `app.use('/uploads', express.static('uploads'))`
- URL format: `http://hostname:3001/uploads/filename.jpg`

### Client-Side URL Construction
```javascript
const getImageUrl = (imagePath) => {
  // Extract filename from path like "/uploads/filename.jpg"
  const filename = imagePath.split('/').pop();
  // Construct full URL
  const apiBase = getApiBaseUrl().replace('/api', '');
  return `${apiBase}/uploads/${filename}`;
};
```

## API Endpoints

### Upload Image
- **POST** `/api/upload/failed-item`
- Body: FormData with `image`, `task_id`, `item_id`, `section_id`, `comment`
- Returns: `{ id, image_path, image_filename }`

### Get Images for Task
- **GET** `/api/upload/task/:taskId`
- Returns: Array of image records from `failed_item_images` table

### Serve Image File
- **GET** `/uploads/:filename`
- Serves the actual image file from `server/uploads/` directory

### Get CM Letter
- **GET** `/api/cm-letters/:id`
- Returns: CM letter with `images` JSONB field containing image references

## Troubleshooting

### Images Not Showing
1. Check if image exists in `server/uploads/` folder
2. Verify `cm_letters.images` JSONB field contains image data
3. Check browser console for URL construction errors
4. Verify server is serving static files from `/uploads` route

### Image Path Issues
- Ensure `image_path` in database is `/uploads/filename.jpg` format
- Check that filename extraction works correctly
- Verify API base URL is correct for your environment

## Current Implementation Status

✅ Images are uploaded and stored correctly
✅ Images are linked to CM letters when tasks fail
✅ CM Letters component displays images under "Issue Description"
✅ Image URLs are constructed correctly
✅ Images are served via static file route
