"use client"

import {useState, useRef, useEffect} from "react"
import {Input} from "@/components/ui/input"
import {Button} from "@/components/ui/button"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Loader2, Send} from "lucide-react"

import {ValuApi, ValuApplication, Intent, APIPointer} from "@arkeytyp/valu-api";
import {useValuAPI} from "@/Hooks/useValuApi.tsx";

type ConsoleEntry = {
  type: "input" | "output" | "error"
  content: string
}

const CONSOLE_ERROR: string = "error";
const CONSOLE_IN: string = "input";
const CONSOLE_OUT: string = "output";

export function Console() {
  const [apiName, setApiName] = useState("")
  const [isIFrame, setIsIFrame] = useState(false)
  const [apiVersion, setApiVersion] = useState('')
  const [command, setCommand] = useState("")
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([])
  const [isLoading, setIsLoading] = useState('')
  const valuApi = useValuAPI();

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const apiPointer = useRef<APIPointer>(null)


  useEffect(() => {

    if (!valuApi)
      return;

    class ReactValuApp extends ValuApplication {
      async onCreate(intent: Intent) {
        addToConsole(CONSOLE_IN, `App created with ${intent.toString()}`);
        this.onIntent(intent);
      }

      async onNewIntent(intent: Intent) {
        addToConsole(CONSOLE_IN, `New Intent received ${intent.toString()}`);
        this.onIntent(intent);
      }

      onIntent (intent: Intent) {

        switch (intent.action) {
          case 'print': {
            addToConsole(CONSOLE_ERROR, intent.params.text);
          }
        }
      }

      onDestroy() {

      }
    }
    const appInstance = new ReactValuApp();
    valuApi.setApplication(appInstance);


    setIsLoading('');
    addToConsole(CONSOLE_IN, 'Connected to Valu App.')

  }, [valuApi]);


  useEffect(() => {

    const runningInIFrame = window.self !== window.top;
    setIsIFrame(runningInIFrame)

    if (runningInIFrame) {
      setIsLoading('Waiting Valu Connection...');
    } else {
      addToConsole(CONSOLE_IN, 'Demo mode initialized.')
    }

  }, []);

  useEffect(() => {
    if (!apiName)
      return;

    if (!valuApi) {
      addToConsole(CONSOLE_ERROR, 'Only available when connected to the Valu app.')
      return
    }

    if (apiName === 'none') {
      apiPointer.current = null;
      addToConsole(CONSOLE_OUT, `Api context cleared`);
      return;
    }

    let version = parseInt(apiVersion, 10);

    const createApiPointer = async () => {
      try {
        setIsLoading('Creating API Pointer...');
        const apiVersion = isNaN(version) ? undefined : version;
        apiPointer.current = await valuApi.getApi(apiName, apiVersion);

        addToConsole(CONSOLE_OUT, `Api context set: ${apiPointer.current.apiName} v${apiPointer.current.version}`);
      } catch (error) {
        apiPointer.current = null;
        addToConsole(CONSOLE_ERROR, error.message);
        addToConsole(CONSOLE_OUT, `Api context cleared`);
      } finally {
        setIsLoading('');
      }
    };

    // Call the async function
    createApiPointer();
  }, [apiName, apiVersion]);


  useEffect(() => {
    if (scrollAreaRef.current && !isLoading) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
    if (!isLoading) {
      inputRef.current?.focus()
    }

  }, [isLoading]) // Updated dependency


  const sampleFunctions = {
    help: () => "Available commands: help, echo, add, divide, randomError, htmlExample, jsonExample, slowCommand",
    echo: (args: string[]) => args.join(" "),
    add: (args: string[]) => {
      const numbers = args.map(Number)
      if (numbers.some(isNaN)) {
        throw new Error("All arguments must be numbers")
      }
      return numbers.reduce((a, b) => a + b, 0).toString()
    },
    divide: (args: string[]) => {
      if (args.length !== 2) throw new Error("Divide requires exactly two arguments")
      const [a, b] = args.map(Number)
      if (isNaN(a) || isNaN(b)) throw new Error("Both arguments must be numbers")
      if (b === 0) throw new Error("Cannot divide by zero")
      return (a / b).toString()
    },
    randomError: () => {
      if (Math.random() < 0.5) {
        return "Lucky you! No error this time."
      }
      throw new Error("Random error occurred")
    },
    htmlExample: () => `
      <h1>HTML Example</h1>
      <p>This is a <strong>bold</strong> and <em>italic</em> text.</p>
      <ul>
        <li>First item</li>
        <li>Second item</li>
        <li>Third item</li>
      </ul>
      <p>Here's some <code>inline code</code></p>
      <pre><code>
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}
      </code></pre>
    `,
    jsonExample: () => JSON.stringify({name: "John Doe", age: 30, city: "New York"}, null, 2),
    slowCommand: () =>
      new Promise<string>((resolve) => {
        setTimeout(() => resolve("This command took 3 seconds to execute."), 3000)
      }),
  }

  const addToConsole = (type, content) => {
    setConsoleEntries((prev) => [
      ...prev,
      {type: type, content: content},
    ])
  };

  const handleExecute = async () => {

    let cmd = command;
    if (apiPointer.current != null) {
      addToConsole(CONSOLE_IN, `${apiPointer.current.apiName} v${apiPointer.current.version} > ${command}`)
    } else {
      addToConsole(CONSOLE_IN, `> ${command}`)
    }

    setIsLoading("Executing command...")
    if (command.startsWith("/")) {
      cmd = command.slice(1);
    }

    const [funcName, ...args] = cmd.split(" ")

    try {
      if (isIFrame) {

        let response: string;
        if (apiPointer.current != null) {

          let result;
          if (args.length === 1) {
            result = await apiPointer.current.run(funcName, args[0]);
          } else {

            let funcParams: Record<string, string | null> = {};
            for (let i = 0; i < args.length; i += 2) {
              let key = args[i];
              if (key.startsWith('-')) {
                key = key.slice(1)
              }
              funcParams[key] = args[i + 1] ?? null;
            }

            console.log(funcParams);
            result = await apiPointer.current.run(funcName, funcParams);
          }


          if (result === undefined) {
            response = 'Execution completed.';
          } else {
            if (typeof result === "string") {
              response = result;
            } else {
              response = JSON.stringify(result);
            }
          }

        } else {
          response = await valuApi.runConsoleCommand(cmd);
        }

        addToConsole(CONSOLE_OUT, response);

      } else {
        // Add a delay to simulate network latency
        await new Promise((resolve) => setTimeout(resolve, 1500))

        if (funcName in sampleFunctions) {
          const result = await sampleFunctions[funcName as keyof typeof sampleFunctions](args)
          addToConsole(CONSOLE_OUT, result)
        } else {
          throw new Error(`Unknown command: ${funcName}`)
        }
      }
    } catch (error) {
      addToConsole(CONSOLE_ERROR, (error as Error).message);
    } finally {
      setIsLoading('')
      setCommand("")
    }

  }

  const renderConsoleEntry = (entry: ConsoleEntry) => {
    if (entry.type === "error" || entry.content.startsWith("Error")) {
      return <div className="text-red-500">{entry.content}</div>
    }
    if (entry.type === "input") {
      return <div className="text-yellow-400 font-bold">{entry.content}</div>
    }

    try {
      const jsonObj = JSON.parse(entry.content)
      return <pre className="whitespace-pre-wrap">{JSON.stringify(jsonObj, null, 2)}</pre>
    } catch {
      return <div className="console-output" dangerouslySetInnerHTML={{__html: entry.content}}/>
    }
  }

  return (
    <div className="bg-gray-100 p-4 rounded-lg mb-8">
      <div className="flex space-x-4 mb-4">
        <Select onValueChange={setApiName} disabled={isLoading}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select API"/>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="app">App</SelectItem>
            <SelectItem value="users">Users</SelectItem>
          </SelectContent>
        </Select>
        <Input
          disabled={isLoading}
          placeholder="API Version (optional)"
          value={apiVersion}
          onChange={(e) => setApiVersion(e.target.value)}
          className="w-[180px]"
        />
      </div>
      <p className="text-sm text-gray-600 mb-2">Terminal used to test commands sending to Valu API</p>
      <div
        className="h-[300px] mb-4 p-4 bg-black text-green-400 font-mono text-xs rounded overflow-auto"
        ref={scrollAreaRef}
      >
        <div className="min-h-full">
          {consoleEntries.map((entry, index) => (
            <div key={index}>{renderConsoleEntry(entry)}</div>
          ))}
          {isLoading && (
            <div className="text-yellow-400 font-bold flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin"/>
              <span>{isLoading}</span>
            </div>
          )}
        </div>

      </div>
      <div className="flex space-x-4">
        <Input
          ref={inputRef}
          placeholder="Enter command (try 'help' for available commands)"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && !isLoading && handleExecute()}
          className="flex-grow"
          disabled={isLoading}
        />
        <Button
          onClick={handleExecute}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors duration-200"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin"/>
          ) : (
            <>
              <Send className="h-5 w-5 mr-2"/>
              Execute
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

