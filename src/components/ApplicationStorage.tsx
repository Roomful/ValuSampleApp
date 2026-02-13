"use client"

import {useState, useEffect, useRef} from "react"
import {Button} from "@/components/ui/button"
import {Trash2, Upload, File, FileText, Image as ImageIcon, FileCode, Archive, Loader2, Search} from "lucide-react"
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

type StorageScope = "app-storage" | "community" | "channel" | "post" | "room" | "room-prop"

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

  // Scope state (shared for search and upload)
  const [scope, setScope] = useState<StorageScope>("app-storage")
  const [communityId, setCommunityId] = useState("")
  const [channelId, setChannelId] = useState("")
  const [postId, setPostId] = useState("")
  const [roomId, setRoomId] = useState("")
  const [propId, setPropId] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    loadFiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuApi])

  const loadFiles = async (query?: string) => {
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
        // Build search params based on scope
        const searchParams: Record<string, unknown> = {
          limit: 10,
        }

        // Add scope-specific parameters
        if (scope === "post") {
          if (communityId) searchParams.communityId = communityId
          if (channelId) searchParams.channelId = channelId
          if (postId) searchParams.postId = postId
        } else if (scope === "channel") {
          if (channelId) searchParams.channelId = channelId
        } else if (scope === "community") {
          if (communityId) searchParams.communityId = communityId
        } else if (scope === "room-prop") {
          if (roomId) searchParams.roomId = roomId
          if (propId) searchParams.propId = propId
        } else if (scope === "room") {
          if (roomId) searchParams.roomId = roomId
        }
        // app-storage: no additional params needed

        // Add search query if provided
        const effectiveQuery = query ?? searchQuery
        if (effectiveQuery) {
          searchParams.query = effectiveQuery
        }

        // Load from Valu API storage using resource-search
        const intent = new Intent("CMS", "resource-search", searchParams)
        const result = await valuApi.callService(intent)

        console.log("CMS search result:", result)

        // Handle different response structures (regular search vs post load)
        const resources = result?.data?.resources || result?.data?.post?.resources || result?.data?.attachments || []

        if (resources.length > 0) {
          const loadedFiles: StorageFile[] = []

          for (const resource of resources) {
            const getUrlIntent = new Intent("Resources", "get-thumbnail-url", {
              resourceId: resource.id,
              thumbnailSize: 256,
            })
            const urlResult = await valuApi.callService(getUrlIntent)

            const file: StorageFile = {
              id: resource.id,
              name: resource.title || resource.name || "Unnamed",
              size: resource.metadata?.fileSize || resource.size || 0,
              type: resource.metadata?.contentType || resource.type || "application/octet-stream",
              uploadedAt: resource.updated ? new Date(resource.updated) : new Date(),
              data: urlResult?.url || undefined,
            }

            loadedFiles.push(file)
          }

          setFiles(loadedFiles)
        } else if (result?.error?.status) {
          console.error("Error loading resources:", result.error)
          setFiles([])
        } else {
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
        // Build upload params based on target
        const intentParams: Record<string, unknown> = { files: fileList }

        // Add scope-specific params (same as search scope)
        if (scope === "post") {
          if (!communityId || !channelId || !postId) {
            alert("Please enter Community ID, Channel ID, and Post ID for post upload")
            setIsUploading(false)
            return
          }
          intentParams.communityId = communityId
          intentParams.channelId = channelId
          intentParams.postId = postId
        } else if (scope === "channel") {
          if (!channelId) {
            alert("Please enter a Channel ID for channel upload")
            setIsUploading(false)
            return
          }
          intentParams.channelId = channelId
        } else if (scope === "community") {
          if (!communityId) {
            alert("Please enter a Community ID for community upload")
            setIsUploading(false)
            return
          }
          intentParams.communityId = communityId
        } else if (scope === "room-prop") {
          if (!roomId || !propId) {
            alert("Please enter Room ID and Prop ID for room prop upload")
            setIsUploading(false)
            return
          }
          intentParams.roomId = roomId
          intentParams.propId = propId
        } else if (scope === "room") {
          if (!roomId) {
            alert("Please enter a Room ID for room upload")
            setIsUploading(false)
            return
          }
          intentParams.roomId = roomId
        }
        // app-storage: no additional params needed

        // Upload to Valu API using unified resource-upload action
        const intent = new Intent("CMS", "resource-upload", intentParams)
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
        // Build delete params based on scope
        const deleteParams: Record<string, unknown> = {
          resourceId: fileId,
        }

        // For post scope, pass IDs so CMS removes resource from post (not delete)
        if (scope === "post" && communityId && channelId && postId) {
          deleteParams.communityId = communityId
          deleteParams.channelId = channelId
          deleteParams.postId = postId
        } else if (scope === "room-prop" && roomId && propId) {
          deleteParams.roomId = roomId
          deleteParams.propId = propId
        } else if (scope === "room" && roomId) {
          deleteParams.roomId = roomId
        }

        const intent = new Intent("CMS", "resource-delete", deleteParams)
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

  type UrlType = "public" | "best-view" | "direct"

  const handleCopyUrl = async (urlType: UrlType) => {
    if (!selectedFile) return
    if (!navigator.clipboard) {
      alert("Clipboard API is not available in this browser")
      return
    }

    setIsCopyingUrl(true)
    try {
      let urlToCopy: string | undefined

      if (valuApi?.connected) {
        const actionMap: Record<UrlType, string> = {
          "public": "generate-public-url",
          "best-view": "generate-best-view-url",
          "direct": "generate-direct-public-url",
        }

        const urlIntent = new Intent("Resources", actionMap[urlType], {
          resourceId: selectedFile.id,
        })
        urlToCopy = await valuApi.callService(urlIntent)
      } else {
        // Demo mode: best-effort – copy data if it looks like a URL
        if (selectedFile.data && (selectedFile.data.startsWith("http") || selectedFile.data.startsWith("data:"))) {
          urlToCopy = selectedFile.data
        }
      }

      if (!urlToCopy) {
        alert("Unable to get URL")
        return
      }

      await navigator.clipboard.writeText(urlToCopy)

      const labelMap: Record<UrlType, string> = {
        "public": "Public URL",
        "best-view": "Best View URL",
        "direct": "Direct URL",
      }
      alert(`${labelMap[urlType]} copied to clipboard`)
    } catch (err) {
      console.error("Copy URL error:", err)
      alert("Error generating or copying URL")
    } finally {
      setIsCopyingUrl(false)
    }
  }

  const handleSearch = () => {
    loadFiles(searchQuery)
  }

  return (
    <div className="bg-gray-100 p-6 rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Application Storage</h2>
      <p className="text-sm text-gray-600 mb-6">
        {valuApi?.connected
          ? "Manage files stored in Valu API - supports app storage, community channels, and community posts"
          : "Demo mode: Files are stored in browser localStorage"}
      </p>

      {/* Scope Controls - Only show when connected */}
      {valuApi?.connected && (
        <div className="bg-white rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Search className="h-5 w-5" />
            Storage Scope
          </h3>
          <p className="text-xs text-gray-500 mb-3">Select where to search and upload files</p>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">Scope</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as StorageScope)}
                className="px-3 py-2 border rounded-md text-sm bg-white"
              >
                <option value="app-storage">App Storage</option>
                <option value="community">Community</option>
                <option value="channel">Channel</option>
                <option value="post">Post</option>
                <option value="room">Room</option>
                <option value="room-prop">Room Prop</option>
              </select>
            </div>

            {(scope === "community" || scope === "post") && (
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">Community ID</label>
                <input
                  type="text"
                  value={communityId}
                  onChange={(e) => setCommunityId(e.target.value)}
                  placeholder="Enter community ID"
                  className="px-3 py-2 border rounded-md text-sm w-48"
                />
              </div>
            )}

            {(scope === "channel" || scope === "post") && (
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">Channel ID</label>
                <input
                  type="text"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  placeholder="Enter channel ID"
                  className="px-3 py-2 border rounded-md text-sm w-48"
                />
              </div>
            )}

            {scope === "post" && (
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">Post ID</label>
                <input
                  type="text"
                  value={postId}
                  onChange={(e) => setPostId(e.target.value)}
                  placeholder="Enter post ID"
                  className="px-3 py-2 border rounded-md text-sm w-48"
                />
              </div>
            )}

            {(scope === "room" || scope === "room-prop") && (
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">Room ID</label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Enter room ID"
                  className="px-3 py-2 border rounded-md text-sm w-48"
                />
              </div>
            )}

            {scope === "room-prop" && (
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">Prop ID</label>
                <input
                  type="text"
                  value={propId}
                  onChange={(e) => setPropId(e.target.value)}
                  placeholder="Enter prop ID"
                  className="px-3 py-2 border rounded-md text-sm w-48"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">Search Query</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name..."
                className="px-3 py-2 border rounded-md text-sm w-48"
              />
            </div>

            <Button
              onClick={handleSearch}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>
        </div>
      )}

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

            {/* Upload destination info - Only show when connected */}
            {valuApi?.connected && (
              <div className="bg-blue-50 rounded-lg p-3 mb-4 border border-blue-200">
                <p className="text-xs text-blue-700">
                  <span className="font-medium">Upload to: </span>
                  {scope === "app-storage" && "App Storage"}
                  {scope === "community" && `Community (${communityId || "ID required"})`}
                  {scope === "channel" && `Channel (${channelId || "ID required"})`}
                  {scope === "post" && `Post (${postId || "IDs required"})`}
                  {scope === "room" && `Room (${roomId || "ID required"})`}
                  {scope === "room-prop" && `Room Prop (${roomId && propId ? `${roomId}/${propId}` : "IDs required"})`}
                </p>
              </div>
            )}

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

                <div className="pt-2 space-y-2">
                  <p className="text-xs text-gray-500 font-medium">Copy URL</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleCopyUrl("public")}
                    disabled={isCopyingUrl}
                  >
                    {isCopyingUrl ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Copying...
                      </>
                    ) : (
                      <>Public URL (Preview)</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleCopyUrl("best-view")}
                    disabled={isCopyingUrl}
                  >
                    Best View URL
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleCopyUrl("direct")}
                    disabled={isCopyingUrl}
                  >
                    Direct URL
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
