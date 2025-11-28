"use client"

import {useState, useEffect, useRef} from "react"
import {Button} from "@/components/ui/button"
import {Trash2, Upload, File, FileText, Image as ImageIcon, FileCode, Archive, Loader2} from "lucide-react"
import {useValuAPI} from "@/Hooks/useValuApi.tsx"
import {Intent} from "@arkeytyp/valu-api"

type StorageFile = {
  id: string
  name: string
  size: number
  type: string
  uploadedAt: Date
  data?: string // base64 or url
}

export default function ApplicationStorage() {
  const [files, setFiles] = useState<StorageFile[]>([])
  const [hoveredFile, setHoveredFile] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<StorageFile | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isCopyingUrl, setIsCopyingUrl] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const valuApi = useValuAPI()

  useEffect(() => {
    loadFiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuApi])

  const loadFiles = async () => {
    setIsLoading(true)
    try {
      if (!valuApi?.connected) {
        // Demo mode - load from localStorage
        const storedFiles = localStorage.getItem("valu_files")
        if (storedFiles) {
          const parsedFiles = JSON.parse(storedFiles)
          const filesWithDates = parsedFiles.map((file: any) => ({
            ...file,
            uploadedAt: new Date(file.uploadedAt),
          }))
          setFiles(filesWithDates)
        }
      } else {
        // Load from Valu API storage
        const intent = new Intent("ApplicationStorage", "resource-search", {
          size: 10,
        })
        const result = await valuApi.callService(intent)

        if (result?.data?.resources) {
          const loadedFiles: StorageFile[] = []

          for (const resource of result.data.resources) {
            const getUrlIntent = new Intent("Resources", "get-thumbnail-url", {
              resourceId: resource.id,
              thumbnailSize: 256,
            })
            const urlResult = await valuApi.callService(getUrlIntent)

            const file: StorageFile = {
              id: resource.id,
              name: resource.title,
              size: resource.metadata?.fileSize || 0,
              type: resource.metadata?.contentType || "application/octet-stream",
              uploadedAt: resource.updated ? new Date(resource.updated) : new Date(),
              data: urlResult?.url || undefined,
            }

            loadedFiles.push(file)
          }

          setFiles(loadedFiles)
        } else {
          console.error("Error loading resources:", result?.error)
          setFiles([])
        }
      }
    } catch (error) {
      console.error("Error loading files:", error)
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }

  const saveFiles = (updatedFiles: StorageFile[]) => {
    if (!valuApi?.connected) {
      localStorage.setItem("valu_files", JSON.stringify(updatedFiles))
    }
    setFiles(updatedFiles)
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon className="h-12 w-12" />
    if (type.includes("text") || type.includes("json")) return <FileText className="h-12 w-12" />
    if (type.includes("zip") || type.includes("rar") || type.includes("tar")) return <Archive className="h-12 w-12" />
    if (
      type.includes("javascript") ||
      type.includes("typescript") ||
      type.includes("html") ||
      type.includes("css")
    )
      return <FileCode className="h-12 w-12" />
    return <File className="h-12 w-12" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return

    setIsUploading(true)

    try {
      if (!valuApi?.connected) {
        // Demo mode - save to localStorage
        const newFiles: StorageFile[] = []

        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i]
          const reader = new FileReader()

          await new Promise<void>((resolve) => {
            reader.onload = (e) => {
              const newFile: StorageFile = {
                id: `${Date.now()}-${i}`,
                name: file.name,
                size: file.size,
                type: file.type,
                uploadedAt: new Date(),
                data: e.target?.result as string,
              }
              newFiles.push(newFile)
              resolve()
            }
            reader.readAsDataURL(file)
          })
        }

        const updatedFiles = [...files, ...newFiles]
        saveFiles(updatedFiles)
        setIsUploading(false)
      } else {
        // Upload to Valu API
        const intent = new Intent("ApplicationStorage", "resource-upload", {files: fileList})
        const result = await valuApi.callService(intent)

        console.log("Upload result:", result)

        if (result?.error) {
          console.error("Upload error:", result.error)
          setIsUploading(false)
        } else {
          setTimeout(async () => {
            await loadFiles()
            setIsUploading(false)
          }, 1000)
        }
      }
    } catch (error) {
      console.error("Error uploading files:", error)
      setIsUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileUpload(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDelete = async (fileId: string) => {
    setIsLoading(true)

    try {
      if (!valuApi?.connected) {
        const updatedFiles = files.filter((f) => f.id !== fileId)
        saveFiles(updatedFiles)
      } else {
        const intent = new Intent("ApplicationStorage", "resource-delete", {
          resourceId: fileId,
        })
        const result = await valuApi.callService(intent)
        if (result?.error?.status) {
          console.error("Delete error:", result.error)
        } else {
          const updatedFiles = files.filter((f) => f.id !== fileId)
          saveFiles(updatedFiles)
        }
      }

      if (selectedFile?.id === fileId) {
        setSelectedFile(null)
      }
    } catch (error) {
      console.error("Error deleting file:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileClick = (file: StorageFile) => {
    setSelectedFile(selectedFile?.id === file.id ? null : file)
  }

  const handleCopyPublicUrl = async () => {
    if (!selectedFile) return
    if (!navigator.clipboard) {
      alert("Clipboard API is not available in this browser")
      return
    }

    setIsCopyingUrl(true)
    try {
      let urlToCopy: string | undefined

      if (valuApi?.connected) {
        const publicUrlIntent = new Intent("Resources", "generate-public-url", {
          resourceId: selectedFile.id,
        })
        urlToCopy = await valuApi.callService(publicUrlIntent)
      } else {
        // Demo mode: best-effort – copy data if it looks like a URL
        if (selectedFile.data && (selectedFile.data.startsWith("http") || selectedFile.data.startsWith("data:"))) {
          urlToCopy = selectedFile.data
        }
      }

      if (!urlToCopy) {
        alert("Unable to get public URL")
        return
      }

      await navigator.clipboard.writeText(urlToCopy)
      alert("Public URL copied to clipboard")
    } catch (err) {
      console.error("Copy URL error:", err)
      alert("Error generating or copying URL")
    } finally {
      setIsCopyingUrl(false)
    }
  }

  return (
    <div className="bg-gray-100 p-6 rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Application Storage</h2>
      <p className="text-sm text-gray-600 mb-6">
        {valuApi?.connected
          ? "Manage files stored in Valu API application storage"
          : "Demo mode: Files are stored in browser localStorage"}
      </p>

      <div className="flex gap-6">
        {/* Files Grid */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Files ({files.length})</h3>
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading...</span>
              </div>
            )}
          </div>

          {isLoading && files.length === 0 ? (
            <div className="bg-white rounded-lg p-12 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-16 w-16 mx-auto mb-4 text-blue-500 animate-spin" />
                <p className="text-gray-500">Loading files...</p>
              </div>
            </div>
          ) : files.length === 0 ? (
            <div className="bg-white rounded-lg p-12 text-center text-gray-400">
              <File className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>No files uploaded yet</p>
              <p className="text-sm mt-2">Drag and drop files or click the upload area</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {files.map((file) => (
                <div
                  key={file.id}
                  onClick={() => handleFileClick(file)}
                  className={`relative bg-white rounded-lg p-4 transition-all cursor-pointer group ${
                    selectedFile?.id === file.id
                      ? "ring-2 ring-blue-500 shadow-lg"
                      : "hover:shadow-lg"
                  }`}
                  onMouseEnter={() => setHoveredFile(file.id)}
                  onMouseLeave={() => setHoveredFile(null)}
                >
                  <div className="flex flex-col items-center">
                    <div className="text-blue-500 mb-2">
                      {file.type.startsWith("image/") && file.data ? (
                        <img
                          src={file.data}
                          alt={file.name}
                          className="h-24 w-24 object-cover rounded"
                        />
                      ) : (
                        getFileIcon(file.type)
                      )}
                    </div>
                    <p className="text-sm font-medium text-center truncate w-full" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>

                  {/* Hover Delete Button */}
                  {hoveredFile === file.id && !isLoading && (
                    <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(file.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side - Upload Area & File Info */}
        <div className="w-80 space-y-6">
          {/* Upload Area */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Upload Files</h3>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`bg-white rounded-lg p-8 border-2 border-dashed transition-colors ${
                isDragging
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 hover:border-gray-400"
              } ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
            >
              <div className="text-center">
                {isUploading ? (
                  <>
                    <Loader2 className="h-12 w-12 mx-auto mb-4 text-blue-500 animate-spin" />
                    <p className="text-sm font-medium mb-2 text-blue-600">Uploading files...</p>
                    <p className="text-xs text-gray-500">Please wait</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-sm font-medium mb-2">Drag and drop files here</p>
                    <p className="text-xs text-gray-500 mb-4">or</p>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Browse Files
                    </Button>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                  disabled={isUploading}
                />
              </div>
            </div>
          </div>

          {/* File Info Panel */}
          {selectedFile && (
            <div className="bg-white rounded-lg p-4 border-2 border-blue-500">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold">File Information</h4>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedFile(null)}
                >
                  ✕
                </Button>
              </div>
              <div className="space-y-3">
                {selectedFile.data && selectedFile.type.startsWith("image/") && (
                  <div className="mb-3">
                    <img
                      src={selectedFile.data}
                      alt={selectedFile.name}
                      className="w-full h-40 object-cover rounded"
                    />
                  </div>
                )}

                <div>
                  <span className="text-xs text-gray-500 font-medium">Name</span>
                  <p className="text-sm font-medium break-all">{selectedFile.name}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium">Size</span>
                  <p className="text-sm font-medium">{formatFileSize(selectedFile.size)}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium">Type</span>
                  <p className="text-sm font-medium">{selectedFile.type || "Unknown"}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-medium">Uploaded</span>
                  <p className="text-sm font-medium">
                    {selectedFile.uploadedAt.toLocaleString()}
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    size="sm"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleCopyPublicUrl}
                    disabled={isCopyingUrl}
                  >
                    {isCopyingUrl ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Copying...
                      </>
                    ) : (
                      <>Copy Public URL</>
                    )}
                  </Button>
                  {!valuApi?.connected && (
                    <p className="mt-1 text-[11px] text-gray-500">
                      In demo mode this copies the underlying data URL if available.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
