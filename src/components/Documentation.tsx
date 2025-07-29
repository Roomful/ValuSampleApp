import {useEffect, useState} from "react";
import ReactMarkdown from "react-markdown";


export default function Documentation() {

    const [readme, setReadme] = useState("")

    useEffect(() => {
        fetch("https://raw.githubusercontent.com/Roomful/valu-api/refs/heads/main/README.md")
            .then((response) => response.text())
            .then((text) => setReadme(text))
            .catch((error) => console.error("Error fetching README:", error))
    }, [])


  return (

      <div className="w-full lg:w-1/3 bg-gray-100 p-6 rounded-lg overflow-auto max-h-[calc(100vh-210px)]">
          <h2 className="text-2xl font-bold mb-4">Documentation</h2>
          <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{readme}</ReactMarkdown>
          </div>
      </div>
  )
}

