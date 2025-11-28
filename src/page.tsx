"use client"

import TopBar from "./components/TopBar"
import {Console} from "./components/Console"
import SampleApiCalls from "./components/SampleApiCalls"
import Footer from "./components/Footer"
import Documentation from "./components/Documentation"
import ApplicationStorage from "./components/ApplicationStorage"
import {useState} from "react"

type TabType = "console" | "storage" | "documentation"

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>("console")

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-grow w-full px-4 py-8">
        <div className="max-w-[1400px] mx-auto">
          {activeTab === "console" && (
            <div>
              <Console />
              <SampleApiCalls />
            </div>
          )}
          {activeTab === "storage" && <ApplicationStorage />}
          {activeTab === "documentation" && <Documentation />}
        </div>
      </main>
      <Footer />
    </div>
  )
}