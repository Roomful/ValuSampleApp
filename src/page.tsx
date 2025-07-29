import TopBar from "./components/TopBar"
import {Console} from "./components/Console"
import SampleApiCalls from "./components/SampleApiCalls"
import Footer from "./components/Footer"
import Documentation from "./components/Documentation"

export default function Home() {

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="flex gap-8">
          <div className="flex-grow">
            <Console />
            <SampleApiCalls />
          </div>
          <Documentation />
        </div>
      </main>
      <Footer />
    </div>
  )
}

