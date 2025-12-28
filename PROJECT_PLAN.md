# SecureVault - Document Scanner & Vault

A React Native (Expo) app demonstrating secure document storage with biometric authentication, native encryption, camera scanning, and OCR.

## Tech Stack
- **Framework**: React Native with Expo (bare workflow)
- **Navigation**: Expo Router
- **Native Module**: Custom Expo module for encryption (Android Keystore + iOS Keychain)
- **Storage**: Encrypted local storage via native module
- **Camera**: expo-camera / react-native-vision-camera
- **OCR**: @react-native-ml-kit/text-recognition
- **UI**: React Native core components + custom styling

---

## Milestone 1: Project Restructure & Foundation ✅
> Rename project, clean up existing code, establish proper architecture

### Tasks
- [x] Rename project from `cryptoNoteVault` to `SecureVault`
  - [x] Update `app.json` (name, slug, scheme)
  - [x] Update `package.json` (name)
  - [x] Update Android package name in native module if needed
- [x] Clean up existing notes-related code
  - [x] Remove old note screens
  - [x] Remove old note types/hooks
- [x] Set up folder structure
  ```
  src/
  ├── components/       # Reusable UI components
  ├── screens/          # Screen components (if not using app/ directory)
  ├── hooks/            # Custom hooks
  ├── services/         # Business logic (document service, etc.)
  ├── types/            # TypeScript types
  ├── utils/            # Utility functions
  └── constants/        # App constants (categories, etc.)
  ```
- [x] Define TypeScript types for documents
  ```typescript
  interface Document {
    id: string;
    title: string;
    category: DocumentCategory;
    tags: string[];
    ocrText?: string;
    thumbnailKey: string;
    fileKey: string;
    fileType: 'image' | 'pdf';
    createdAt: string;
    updatedAt: string;
  }
  ```
- [x] Create document categories enum
  ```typescript
  enum DocumentCategory {
    ID = 'id',
    MEDICAL = 'medical',
    FINANCE = 'finance',
    LEGAL = 'legal',
    INSURANCE = 'insurance',
    RECEIPTS = 'receipts',
    OTHER = 'other'
  }
  ```

---

## Milestone 2: Native Module Enhancement (Binary File Support) ✅
> Add native methods to encrypt/decrypt binary files efficiently

### Tasks
- [x] **Android: Add `putFile` method**
  - [x] Read file from provided path as bytes
  - [x] Encrypt bytes using existing AES-GCM cipher
  - [x] Store encrypted bytes to app's private storage
  - [x] Store IV for the file
  - [x] Return success/failure

- [x] **Android: Add `getFile` method**
  - [x] Read encrypted bytes from storage
  - [x] Retrieve IV for the file
  - [x] Decrypt bytes using AES-GCM cipher
  - [x] Write decrypted bytes to destination path
  - [x] Return destination path or failure

- [x] **Android: Add `deleteFile` method**
  - [x] Delete encrypted file from storage
  - [x] Delete associated IV

- [ ] **Android: Add `getFileUri` method** (optional, for sharing)
  - [ ] Decrypt file to cache directory
  - [ ] Return content:// URI via FileProvider

- [x] **iOS: Add `putFile` method**
  - [x] Read file as Data
  - [x] Encrypt using Keychain-stored key
  - [x] Store to app's documents directory
  - [x] Return success/failure

- [x] **iOS: Add `getFile` method**
  - [x] Read encrypted data
  - [x] Decrypt using Keychain-stored key
  - [x] Write to destination path
  - [x] Return path or failure

- [x] **iOS: Add `deleteFile` method**
  - [x] Delete encrypted file

- [x] **Update TypeScript types**
  ```typescript
  interface SecureVault {
    // Existing
    createVault(): Promise<void>;
    unlockWithBiometrics(): Promise<boolean>;
    put(key: string, value: string): Promise<void>;
    get(key: string): Promise<string>;
    delete(key: string): Promise<void>;
    getAllKeys(): Promise<string[]>;

    // New file methods
    putFile(key: string, sourcePath: string): Promise<void>;
    getFile(key: string, destPath: string): Promise<string>;
    deleteFile(key: string): Promise<void>;
    getFileSize(key: string): Promise<number>;
  }
  ```

- [ ] **Write unit tests for native module**
  - [ ] Test encryption/decryption roundtrip
  - [ ] Test with various file sizes
  - [ ] Test error handling (file not found, etc.)

---

## Milestone 3: Document Service Layer ✅
> Create service to manage document CRUD operations

### Tasks
- [x] Create `DocumentService` class/module
  ```typescript
  class DocumentService {
    async addDocument(file: PickedFile, metadata: Partial<Document>): Promise<Document>
    async getDocument(id: string): Promise<Document>
    async getDocumentFile(id: string): Promise<string> // Returns decrypted file path
    async getAllDocuments(): Promise<Document[]>
    async updateDocument(id: string, updates: Partial<Document>): Promise<Document>
    async deleteDocument(id: string): Promise<void>
    async searchDocuments(query: string): Promise<Document[]>
    async getDocumentsByCategory(category: DocumentCategory): Promise<Document[]>
  }
  ```

- [x] Implement document metadata storage
  - [x] Store as JSON string via `vault.put()`
  - [x] Index structure for fast lookups

- [x] Implement file storage
  - [x] Generate unique file keys
  - [x] Store original file via `vault.putFile()`
  - [x] Generate and store thumbnail for images

- [x] Implement thumbnail generation
  - [x] Resize images to ~200px width
  - [x] Store thumbnail separately for fast list loading

- [x] Create `useDocuments` hook
  ```typescript
  function useDocuments() {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);

    // Methods
    addDocument, deleteDocument, updateDocument, refreshDocuments

    return { documents, loading, ...methods };
  }
  ```

---

## Milestone 4: Core UI - Document List & Viewer ✅
> Build the main screens for viewing and managing documents

### Tasks
- [x] **Lock Screen (update existing)**
  - [x] Update branding/text for SecureVault
  - [x] Add app icon/logo
  - [x] Improve styling

- [x] **Documents List Screen**
  - [x] Header with search icon and add button
  - [x] Category filter chips (horizontal scroll)
  - [x] Document grid/list view
    - [x] Thumbnail image
    - [x] Title
    - [x] Category badge
    - [x] Date
  - [x] Empty state when no documents
  - [x] Pull-to-refresh
  - [x] Loading skeleton

- [x] **Document Detail Screen**
  - [x] Full-screen image viewer with pinch-to-zoom
  - [ ] PDF viewer for PDF files (basic image display works)
  - [x] Document metadata display
    - [x] Title (editable)
    - [x] Category (editable)
    - [x] Tags (editable)
    - [x] Created/updated dates
  - [x] OCR text section (expandable)
  - [x] Action buttons
    - [x] Share
    - [x] Delete
    - [ ] Edit metadata (view-only for now)

- [x] **Add Document Modal/Screen**
  - [x] Option: Scan with camera
  - [x] Option: Pick from gallery
  - [x] Option: Pick from files (PDF)
  - [x] After selection:
    - [x] Preview image
    - [x] Title input
    - [x] Category picker
    - [x] Tags input
    - [x] Save button

- [x] **Settings Screen**
  - [ ] Auto-lock timeout setting
  - [x] Export vault (encrypted backup)
  - [x] Import vault
  - [x] About section
  - [x] Clear all data (with confirmation)
  - [x] Lock vault button

---

## Milestone 5: File Picking & Basic Import
> Implement document import from gallery and files (works in emulator)

### Tasks
- [ ] Install dependencies
  ```bash
  npx expo install expo-image-picker expo-document-picker
  ```

- [ ] **Image Picker Integration**
  - [ ] Request permissions
  - [ ] Pick image from gallery
  - [ ] Handle picked image URI
  - [ ] Pass to document service

- [ ] **Document Picker Integration**
  - [ ] Pick PDF files
  - [ ] Handle picked file URI
  - [ ] Pass to document service

- [ ] **File Processing Pipeline**
  ```
  Pick File → Copy to temp → Generate thumbnail → Run OCR → Encrypt & Store → Save metadata
  ```

- [ ] **Progress indicator during import**
  - [ ] Show steps: Processing → Encrypting → Saving

- [ ] **Test in emulator**
  - [ ] Verify image import works
  - [ ] Verify PDF import works
  - [ ] Verify encrypted storage
  - [ ] Verify retrieval and display

---

## Milestone 6: Camera Scanning
> Implement document scanning with camera

### Tasks
- [ ] Install camera dependency
  ```bash
  npx expo install expo-camera
  # OR for better quality:
  # npm install react-native-vision-camera
  ```

- [ ] **Camera Screen**
  - [ ] Full-screen camera preview
  - [ ] Capture button
  - [ ] Flash toggle
  - [ ] Switch camera button
  - [ ] Guide overlay (document corners)
  - [ ] Cancel button

- [ ] **Image Enhancement (optional but impressive)**
  - [ ] Auto-crop to document edges
  - [ ] Perspective correction
  - [ ] Contrast enhancement
  - [ ] Could use `react-native-perspective-image-cropper` or similar

- [ ] **Post-capture flow**
  - [ ] Preview captured image
  - [ ] Retake option
  - [ ] Use photo option → goes to add document flow

- [ ] **Multi-page scanning (nice-to-have)**
  - [ ] Add more pages button
  - [ ] Page thumbnails
  - [ ] Reorder pages
  - [ ] Create multi-page PDF

---

## Milestone 7: OCR Integration
> Extract text from documents for searchability

### Tasks
- [ ] Install ML Kit
  ```bash
  npm install @react-native-ml-kit/text-recognition
  ```

- [ ] **OCR Service**
  ```typescript
  async function extractText(imagePath: string): Promise<string>
  ```

- [ ] **Integrate OCR into import flow**
  - [ ] Run OCR after image capture/pick
  - [ ] Store extracted text in document metadata
  - [ ] Show progress during OCR

- [ ] **Display OCR results**
  - [ ] Expandable section in document detail
  - [ ] Copy text button
  - [ ] Highlight search matches

- [ ] **Handle OCR failures gracefully**
  - [ ] Continue without OCR if it fails
  - [ ] Allow manual retry

---

## Milestone 8: Search & Filtering
> Implement full-text search across documents

### Tasks
- [ ] **Search Implementation**
  - [ ] Search bar component
  - [ ] Search across:
    - [ ] Document titles
    - [ ] OCR text content
    - [ ] Tags
  - [ ] Debounced search input
  - [ ] Highlight matching text in results

- [ ] **Filter Implementation**
  - [ ] Filter by category
  - [ ] Filter by date range
  - [ ] Filter by tags
  - [ ] Combine filters

- [ ] **Sort Options**
  - [ ] Sort by date (newest/oldest)
  - [ ] Sort by title (A-Z)
  - [ ] Sort by category

- [ ] **Search Results UI**
  - [ ] Show matching documents
  - [ ] Show snippet of matching OCR text
  - [ ] Empty state for no results

---

## Milestone 9: Polish & Production Ready
> Final touches, error handling, and performance

### Tasks
- [ ] **Error Handling**
  - [ ] Graceful error messages
  - [ ] Retry mechanisms
  - [ ] Error boundaries

- [ ] **Loading States**
  - [ ] Skeleton loaders
  - [ ] Progress indicators
  - [ ] Optimistic updates

- [ ] **Performance**
  - [ ] Lazy load document thumbnails
  - [ ] Virtualized list for many documents
  - [ ] Cache decrypted thumbnails in memory (secure)

- [ ] **Animations**
  - [ ] Screen transitions
  - [ ] List item animations
  - [ ] Micro-interactions

- [ ] **Accessibility**
  - [ ] Screen reader labels
  - [ ] Sufficient contrast
  - [ ] Touch target sizes

- [ ] **App Icon & Splash Screen**
  - [ ] Design app icon
  - [ ] Configure splash screen

- [ ] **README.md**
  - [ ] Project description
  - [ ] Features list
  - [ ] Screenshots/GIFs
  - [ ] Tech stack
  - [ ] Setup instructions
  - [ ] Architecture overview

---

## Milestone 10: Stretch Goals (Optional)
> Extra features if time permits

### Tasks
- [ ] **Cloud Backup**
  - [ ] Encrypted export to cloud (Google Drive / iCloud)
  - [ ] Import from cloud backup

- [ ] **PDF Generation**
  - [ ] Convert scanned images to PDF
  - [ ] Multi-page PDF support

- [ ] **Document Templates**
  - [ ] Quick-add templates (ID, receipt, etc.)
  - [ ] Auto-categorization based on content

- [ ] **Widgets**
  - [ ] Quick-scan widget (Android)
  - [ ] Recent documents widget

- [ ] **Dark Mode**
  - [ ] System-aware theme
  - [ ] Manual toggle

---

## Progress Tracking

| Milestone | Status | Completion |
|-----------|--------|------------|
| 1. Project Restructure | ✅ Complete | 100% |
| 2. Native Module Enhancement | ✅ Complete | 100% |
| 3. Document Service Layer | ✅ Complete | 100% |
| 4. Core UI | ✅ Complete | 95% |
| 5. File Picking | ✅ Complete | 100% |
| 6. Camera Scanning | ✅ Complete | 100% |
| 7. OCR Integration | Not Started | 0% |
| 8. Search & Filtering | ✅ Complete | 100% |
| 9. Polish | Not Started | 0% |
| 10. Stretch Goals | Not Started | 0% |

---

## Notes

- Start with Milestones 1-5 for a working MVP demo-able in emulator
- Milestone 6 (Camera) requires real device but is high-impact
- Milestone 7 (OCR) is impressive for employers but can be added later
- Focus on code quality over feature quantity
