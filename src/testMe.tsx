import {useEffect, useState} from "react";


export default function Main() {

    const [name, setName] = useState("")

    useEffect(() => {
        setName('Stan')
        console.log('Hello World ', name);
    }, []);

    return (
        <div className="flex flex-col min-h-screen">
           Some text Here {name}
        </div>
    )
}