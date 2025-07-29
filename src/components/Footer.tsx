//import Link from "next/link"

export default function Footer() {
  return (
    <footer className="bg-gray-200 p-4">
      <div className="container mx-auto flex justify-between items-center">
        <p>&copy; 2025 Valu iFrame Sample App</p>
        <div className="space-x-4">

          <a href="https://github.com/Roomful/valu-api" className="text-blue-600 hover:underline">
            GitHub
          </a>
          <a href="https://www.npmjs.com/package/@arkeytyp/valu-api" className="text-blue-600 hover:underline">
            NPM Package
          </a>
          <a href="https://github.com/Roomful/valu-api?tab=readme-ov-file#usage" className="text-blue-600 hover:underline">
            Documentation
          </a>
        </div>
      </div>
    </footer>
  )
}

