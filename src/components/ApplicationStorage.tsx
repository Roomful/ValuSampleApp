"use client"

import {useState, useEffect, useRef, useCallback, useSyncExternalStore} from "react"
import {Button} from "@/components/ui/button"
import {MoreVertical, Trash2, Upload, File, FileText, Image as ImageIcon, FileCode, Archive, Loader2, Search, X, FolderOpen, Eye, ExternalLink, Video, Link2, Play} from "lucide-react"
import {useValuAPI} from "@/Hooks/useValuApi.tsx"
import {Intent} from "@arkeytyp/valu-api"

type StorageFile = {
  id: string
  name: string
  size: number
  type: string
  uploadedAt: Date
  data?: string // base64 or url
  link?: string // for roomful#url resources
  previewUrl?: string // favicon / preview for roomful#url
}

type StorageScope = "app-storage" | "community" | "community-channel" | "directory" | "post" | "room" | "room-prop"

export default function ApplicationStorage() {
  const [files, setFiles] = useState<StorageFile[]>([])
  const [menuOpenFile, setMenuOpenFile] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<StorageFile | null>(null)
  const [previewImage, setPreviewImage] = useState<StorageFile | null>(null)
  const [videoPlayerUrl, setVideoPlayerUrl] = useState<string | null>(null)
  const [videoPlayerName, setVideoPlayerName] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isCopyingUrl, setIsCopyingUrl] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const valuApi = useValuAPI()

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenFile(null)
      }
    }
    if (menuOpenFile) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [menuOpenFile])

  // --- URL-based history (works with or without React Router) ---
  // Subscribe to popstate (back/forward) for reactive re-renders
  const urlSearch = useSyncExternalStore(
    (cb) => { window.addEventListener("popstate", cb); return () => window.removeEventListener("popstate", cb) },
    () => window.location.search,
  )

  const getParams = useCallback(() => new URLSearchParams(urlSearch), [urlSearch])

  const scope = (getParams().get("scope") as StorageScope) || "app-storage"
  const communityId = getParams().get("communityId") || ""
  const channelId = getParams().get("channelId") || ""
  const postId = getParams().get("postId") || ""
  const roomId = getParams().get("roomId") || ""
  const propId = getParams().get("propId") || ""
  const directoryId = getParams().get("directoryId") || ""
  const searchQuery = getParams().get("q") || ""

  // Update URL params — push creates a history entry, replace does not
  const updateUrl = useCallback((updates: Record<string, string | null>, push: boolean) => {
    const next = new URLSearchParams(window.location.search)
    for (const [key, value] of Object.entries(updates)) {
      if (value) { next.set(key, value) } else { next.delete(key) }
    }
    const url = `${window.location.pathname}${next.toString() ? "?" + next.toString() : ""}`
    if (push) {
      window.history.pushState(null, "", url)
    } else {
      window.history.replaceState(null, "", url)
    }
    // Trigger a re-render for useSyncExternalStore
    window.dispatchEvent(new PopStateEvent("popstate"))
  }, [])

  // Reload counter — incremented on intentional navigations (not form typing)
  const [loadVersion, setLoadVersion] = useState(0)

  // Navigation action — push history entry and trigger reload
  const navigateTo = useCallback((updates: Record<string, string | null>) => {
    updateUrl(updates, true)
    setLoadVersion((v) => v + 1)
  }, [updateUrl])

  // Form field setters — replace URL silently (no reload, no history entry)
  const setScope = (v: StorageScope) => updateUrl({ scope: v === "app-storage" ? null : v }, false)
  const setCommunityId = (v: string) => updateUrl({ communityId: v || null }, false)
  const setChannelId = (v: string) => updateUrl({ channelId: v || null }, false)
  const setPostId = (v: string) => updateUrl({ postId: v || null }, false)
  const setRoomId = (v: string) => updateUrl({ roomId: v || null }, false)
  const setPropId = (v: string) => updateUrl({ propId: v || null }, false)
  const setDirectoryId = (v: string) => updateUrl({ directoryId: v || null }, false)

  // Search query uses local state so we don't reload on every keystroke
  const [searchQueryInput, setSearchQueryInput] = useState(searchQuery)

  // Detect browser back/forward — sync search input and trigger reload
  const prevUrlSearch = useRef(urlSearch)
  useEffect(() => {
    if (prevUrlSearch.current !== urlSearch) {
      const wasPopstate = prevUrlSearch.current !== urlSearch
      prevUrlSearch.current = urlSearch
      if (wasPopstate) {
        setSearchQueryInput(new URLSearchParams(urlSearch).get("q") || "")
        setLoadVersion((v) => v + 1)
      }
    }
  }, [urlSearch])

  // Reload on intentional navigations and initial mount
  useEffect(() => {
    loadFiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuApi, loadVersion])

  const PAGE_SIZE = 10

  const loadFiles = async (options?: { append?: boolean }) => {
    const append = options?.append ?? false

    if (append) {
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
      setFiles([])
      setSelectedFile(null)
      setHasMore(false)
      setNextCursor(null)
    }

    // Check required fields before attempting to load
    if (valuApi?.connected) {
      const missing =
        (scope === "post" && (!communityId || !channelId || !postId)) ||
        (scope === "community-channel" && (!communityId || !channelId)) ||
        (scope === "community" && !communityId) ||
        (scope === "directory" && !directoryId) ||
        (scope === "room" && !roomId) ||
        (scope === "room-prop" && (!roomId || !propId))
      if (missing) {
        setIsLoading(false)
        setIsLoadingMore(false)
        return
      }
    }

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
          setHasMore(false)
        }
      } else {
        // Build search params based on scope (read from URL)
        const apiParams: Record<string, unknown> = {
          limit: PAGE_SIZE,
        }

        // Add cursor for pagination
        if (append && nextCursor) {
          apiParams.cursor = nextCursor
        }

        // Add scope-specific parameters
        if (scope === "post") {
          if (communityId) apiParams.communityId = communityId
          if (channelId) apiParams.channelId = channelId
          if (postId) apiParams.postId = postId
        } else if (scope === "community-channel") {
          if (communityId) apiParams.communityId = communityId
          if (channelId) apiParams.channelId = channelId
        } else if (scope === "directory") {
          if (directoryId) apiParams.directoryId = directoryId
        } else if (scope === "community") {
          if (communityId) apiParams.communityId = communityId
        } else if (scope === "room-prop") {
          if (roomId) apiParams.roomId = roomId
          if (propId) apiParams.propId = propId
        } else if (scope === "room") {
          if (roomId) apiParams.roomId = roomId
        }
        // app-storage: no additional params needed

        // Add search query if provided
        if (searchQuery) {
          apiParams.query = searchQuery
        }

        // Load from Valu API storage using resource-search
        const intent = new Intent("CMS", "resource-search", apiParams)
        const result = await valuApi.callService(intent)

        console.log("CMS search result:", result)

        // Handle different response structures (regular search vs post load)
        const resources = result?.data?.resources || result?.data?.post?.resources || result?.data?.attachments || []

        if (resources.length > 0) {
          const loadedFiles: StorageFile[] = []

          for (const resource of resources) {
            const contentType = resource.metadata?.contentType || resource.type || "application/octet-stream"
            const isUrl = contentType === "roomful#url"

            // Only fetch thumbnails for non-url resources
            let thumbnailUrl: string | undefined
            if (!isUrl) {
              const getUrlIntent = new Intent("Resources", "get-thumbnail-url", {
                resourceId: resource.id,
                thumbnailSize: 256,
              })
              const urlResult = await valuApi.callService(getUrlIntent)
              thumbnailUrl = urlResult?.url || undefined
            }

            const file: StorageFile = {
              id: resource.id,
              name: resource.title || resource.name || resource.metadata?.fileName || "Unnamed",
              size: resource.metadata?.fileSize || resource.size || 0,
              type: contentType,
              uploadedAt: resource.updated ? new Date(resource.updated) : new Date(),
              data: thumbnailUrl,
              link: isUrl ? resource.metadata?.link : undefined,
              previewUrl: isUrl ? resource.data?.remoteUrl?.favicon : undefined,
            }

            loadedFiles.push(file)
          }

          setFiles((prev) => append ? [...prev, ...loadedFiles] : loadedFiles)
          setHasMore(result?.data?.hasMore === true)
          setNextCursor(result?.data?.nextCursor || null)
        } else if (result?.error?.status) {
          console.error("Error loading resources:", result.error)
          if (!append) setFiles([])
          setHasMore(false)
          setNextCursor(null)
        } else {
          if (!append) setFiles([])
          setHasMore(false)
          setNextCursor(null)
        }
      }
    } catch (error) {
      console.error("Error loading files:", error)
      if (!append) setFiles([])
      setHasMore(false)
      setNextCursor(null)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }

  const loadMore = () => {
    loadFiles({ append: true })
  }

  const saveFiles = (updatedFiles: StorageFile[]) => {
    if (!valuApi?.connected) {
      localStorage.setItem("valu_files", JSON.stringify(updatedFiles))
    }
    setFiles(updatedFiles)
  }

  const isDirectory = (type: string) =>
    type === "directory" || type === "inode/directory" || type === "application/x-directory"

  const isRoomfulUrl = (type: string) => type === "roomful#url"
  const isPdf = (type: string) => type === "application/pdf"
  const isVideo = (type: string) => type.startsWith("video/")

  const getFileIcon = (type: string) => {
    if (isDirectory(type)) return <FolderOpen className="h-12 w-12" />
    if (isRoomfulUrl(type)) return <Link2 className="h-12 w-12" />
    if (isPdf(type)) return (
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <text x="12" y="17" textAnchor="middle" fill="currentColor" stroke="none" fontSize="6" fontWeight="bold" fontFamily="system-ui">PDF</text>
      </svg>
    )
    if (isVideo(type)) return <Video className="h-12 w-12" />
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

  const getIconColor = (type: string) => {
    if (isDirectory(type)) return "text-amber-500"
    if (isRoomfulUrl(type)) return "text-green-500"
    if (isPdf(type)) return "text-red-500"
    if (isVideo(type)) return "text-purple-500"
    return "text-blue-500"
  }

  const handleOpenDirectory = (file: StorageFile) => {
    setSelectedFile(null)
    setMenuOpenFile(null)
    navigateTo({ scope: "directory", directoryId: file.id })
  }

  const openImagePreview = async (file: StorageFile) => {
    if (valuApi?.connected) {
      const intent = new Intent("Resources", "get-thumbnail-url", {
        resourceId: file.id,
        thumbnailSize: 1024,
      })
      const result = await valuApi.callService(intent)
      setPreviewImage({ ...file, data: result?.url || file.data })
    } else {
      setPreviewImage(file)
    }
  }

  const openVideoPlayer = async (file: StorageFile) => {
    setVideoPlayerName(file.name)
    if (valuApi?.connected) {
      const intent = new Intent("Resources", "generate-direct-public-url", {
        resourceId: file.id,
      })
      const url = await valuApi.callService(intent)
      if (url) {
        setVideoPlayerUrl(url)
      } else {
        alert("Unable to get video URL")
      }
    } else if (file.data) {
      setVideoPlayerUrl(file.data)
    }
  }

  const handleOpenLink = (file: StorageFile) => {
    if (file.link) {
      window.open(file.link, "_blank", "noopener,noreferrer")
    }
  }

  const handleDoubleClick = (file: StorageFile) => {
    if (isDirectory(file.type)) {
      handleOpenDirectory(file)
    } else if (isRoomfulUrl(file.type)) {
      handleOpenLink(file)
    } else if (file.type.startsWith("image/")) {
      openImagePreview(file)
    } else if (isVideo(file.type)) {
      openVideoPlayer(file)
    }
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
        } else if (scope === "community-channel") {
          if (!communityId || !channelId) {
            alert("Please enter Community ID and Channel ID for community channel upload")
            setIsUploading(false)
            return
          }
          intentParams.communityId = communityId
          intentParams.channelId = channelId
        } else if (scope === "directory") {
          if (!directoryId) {
            alert("Please enter a Directory ID for directory upload")
            setIsUploading(false)
            return
          }
          intentParams.directoryId = directoryId
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
    navigateTo({ q: searchQueryInput || null })
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
                <option value="community-channel">Community Channel</option>
                <option value="directory">Directory</option>
                <option value="post">Post</option>
                <option value="room">Room</option>
                <option value="room-prop">Room Prop</option>
              </select>
            </div>

            {(scope === "community" || scope === "community-channel" || scope === "post") && (
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

            {(scope === "community-channel" || scope === "post") && (
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

            {scope === "directory" && (
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">Directory ID</label>
                <input
                  type="text"
                  value={directoryId}
                  onChange={(e) => setDirectoryId(e.target.value)}
                  placeholder="Enter directory ID"
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
                value={searchQueryInput}
                onChange={(e) => setSearchQueryInput(e.target.value)}
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
                  onDoubleClick={() => handleDoubleClick(file)}
                  className={`relative bg-white rounded-lg p-4 transition-all cursor-pointer group ${
                    selectedFile?.id === file.id
                      ? "ring-2 ring-blue-500 shadow-lg"
                      : "hover:shadow-lg"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <div className={`mb-2 ${getIconColor(file.type)}`}>
                      {file.type.startsWith("image/") && file.data ? (
                        <img
                          src={file.data}
                          alt={file.name}
                          className="h-24 w-24 object-cover rounded"
                        />
                      ) : isVideo(file.type) && file.data ? (
                        <div className="relative h-24 w-24">
                          <img
                            src={file.data}
                            alt={file.name}
                            className="h-24 w-24 object-cover rounded"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="bg-black/50 rounded-full p-2">
                              <Play className="h-5 w-5 text-white fill-white" />
                            </div>
                          </div>
                        </div>
                      ) : isRoomfulUrl(file.type) && file.previewUrl ? (
                        <div className="relative h-24 w-24 flex items-center justify-center">
                          <img
                            src={file.previewUrl}
                            alt={file.name}
                            className="h-12 w-12 object-contain rounded"
                          />
                        </div>
                      ) : (
                        getFileIcon(file.type)
                      )}
                    </div>
                    <p className="text-sm font-medium text-center truncate w-full" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {isDirectory(file.type) ? "Directory"
                        : isRoomfulUrl(file.type) ? "Link"
                        : isPdf(file.type) ? `PDF - ${formatFileSize(file.size)}`
                        : isVideo(file.type) ? `Video - ${formatFileSize(file.size)}`
                        : formatFileSize(file.size)}
                    </p>
                  </div>

                  {/* 3-dot context menu button */}
                  <button
                    className="absolute top-2 right-2 p-1 rounded-md bg-gray-100 hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpenFile(menuOpenFile === file.id ? null : file.id)
                    }}
                  >
                    <MoreVertical className="h-4 w-4 text-gray-600" />
                  </button>

                  {/* Context menu dropdown */}
                  {menuOpenFile === file.id && (
                    <div
                      ref={menuRef}
                      className="absolute top-9 right-2 z-10 bg-gray-50 rounded-md shadow-xl border border-gray-200 py-1 min-w-[130px] animate-fade-in"
                    >
                      {isDirectory(file.type) && (
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenDirectory(file)
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open
                        </button>
                      )}
                      {isRoomfulUrl(file.type) && file.link && (
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpenFile(null)
                            handleOpenLink(file)
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open Link
                        </button>
                      )}
                      {file.type.startsWith("image/") && file.data && (
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpenFile(null)
                            openImagePreview(file)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          Preview
                        </button>
                      )}
                      {isVideo(file.type) && (
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpenFile(null)
                            openVideoPlayer(file)
                          }}
                        >
                          <Play className="h-4 w-4" />
                          Play
                        </button>
                      )}
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpenFile(null)
                          handleDelete(file.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Load More */}
          {hasMore && !isLoading && (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>Load More</>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Right Side - Upload Area or File Info */}
        <div className="w-80">
          {selectedFile ? (
            /* File Info Panel - replaces Upload when a file is selected */
            <div key={selectedFile.id} className="bg-white rounded-lg p-4 border-2 border-blue-500 animate-slide-in">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold">File Information</h4>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-3">
                {/* Thumbnail / preview */}
                {selectedFile.data && selectedFile.type.startsWith("image/") && (
                  <div className="mb-3">
                    <img
                      src={selectedFile.data}
                      alt={selectedFile.name}
                      className="w-full h-40 object-cover rounded"
                    />
                  </div>
                )}
                {isVideo(selectedFile.type) && selectedFile.data && (
                  <div
                    className="mb-3 relative cursor-pointer"
                    onClick={() => openVideoPlayer(selectedFile)}
                  >
                    <img
                      src={selectedFile.data}
                      alt={selectedFile.name}
                      className="w-full h-40 object-cover rounded"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-black/50 rounded-full p-3">
                        <Play className="h-6 w-6 text-white fill-white" />
                      </div>
                    </div>
                  </div>
                )}
                {isRoomfulUrl(selectedFile.type) && selectedFile.previewUrl && (
                  <div className="mb-3 flex items-center gap-3 bg-gray-50 rounded p-3">
                    <img
                      src={selectedFile.previewUrl}
                      alt="favicon"
                      className="h-8 w-8 object-contain"
                    />
                    {selectedFile.link && (
                      <a
                        href={selectedFile.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline truncate"
                      >
                        {selectedFile.link}
                      </a>
                    )}
                  </div>
                )}

                <div>
                  <span className="text-xs text-gray-500 font-medium">Name</span>
                  <p className="text-sm font-medium break-all">{selectedFile.name}</p>
                </div>
                {!isDirectory(selectedFile.type) && !isRoomfulUrl(selectedFile.type) && (
                  <div>
                    <span className="text-xs text-gray-500 font-medium">Size</span>
                    <p className="text-sm font-medium">{formatFileSize(selectedFile.size)}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs text-gray-500 font-medium">Type</span>
                  <p className="text-sm font-medium">{selectedFile.type || "Unknown"}</p>
                </div>
                {isRoomfulUrl(selectedFile.type) && selectedFile.link && (
                  <div>
                    <span className="text-xs text-gray-500 font-medium">URL</span>
                    <p className="text-sm font-medium break-all text-blue-600">{selectedFile.link}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs text-gray-500 font-medium">Uploaded</span>
                  <p className="text-sm font-medium">
                    {selectedFile.uploadedAt.toLocaleString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t">
                  <p className="text-xs text-gray-500 font-medium mb-2">Actions</p>
                  <div className="space-y-2">
                    {/* Open action for directories */}
                    {isDirectory(selectedFile.type) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => handleOpenDirectory(selectedFile)}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open Directory
                      </Button>
                    )}

                    {/* Open link for roomful#url */}
                    {isRoomfulUrl(selectedFile.type) && selectedFile.link && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => handleOpenLink(selectedFile)}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open Link
                      </Button>
                    )}

                    {/* Preview action for images */}
                    {selectedFile.type.startsWith("image/") && selectedFile.data && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => openImagePreview(selectedFile)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview Image
                      </Button>
                    )}

                    {/* Play action for videos */}
                    {isVideo(selectedFile.type) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => openVideoPlayer(selectedFile)}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Play Video
                      </Button>
                    )}
                  </div>
                </div>

                {/* Copy URL section — hidden for directories and roomful#url */}
                {!isDirectory(selectedFile.type) && !isRoomfulUrl(selectedFile.type) && (
                  <div className="pt-3 border-t">
                    <p className="text-xs text-gray-500 font-medium mb-2">Copy URL</p>
                    <div className="space-y-2">
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
                )}

                {/* Danger zone */}
                <div className="pt-3 border-t">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full"
                    disabled={isLoading}
                    onClick={() => {
                      const id = selectedFile.id
                      setSelectedFile(null)
                      handleDelete(id)
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete File
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Upload Area - shown when no file is selected */
            <div className="animate-fade-in">
              <h3 className="text-lg font-semibold mb-4">Upload Files</h3>

              {/* Upload destination info - Only show when connected */}
              {valuApi?.connected && (
                <div className="bg-blue-50 rounded-lg p-3 mb-4 border border-blue-200">
                  <p className="text-xs text-blue-700">
                    <span className="font-medium">Upload to: </span>
                    {scope === "app-storage" && "App Storage"}
                    {scope === "community" && `Community (${communityId || "ID required"})`}
                    {scope === "community-channel" && `Community Channel (${communityId && channelId ? `${communityId}/${channelId}` : "IDs required"})`}
                    {scope === "directory" && `Directory (${directoryId || "ID required"})`}
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
          )}
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-3xl max-h-[80vh] animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100"
              onClick={() => setPreviewImage(null)}
            >
              <X className="h-5 w-5 text-gray-700" />
            </button>
            <img
              src={previewImage.data}
              alt={previewImage.name}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            <p className="text-center text-white text-sm mt-3">{previewImage.name}</p>
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {videoPlayerUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setVideoPlayerUrl(null)}
        >
          <div
            className="relative max-w-4xl w-full mx-4 animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute -top-3 -right-3 z-10 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100"
              onClick={() => setVideoPlayerUrl(null)}
            >
              <X className="h-5 w-5 text-gray-700" />
            </button>
            <video
              src={videoPlayerUrl}
              controls
              autoPlay
              className="w-full max-h-[80vh] rounded-lg bg-black"
            />
            <p className="text-center text-white text-sm mt-3">{videoPlayerName}</p>
          </div>
        </div>
      )}
    </div>
  )
}
