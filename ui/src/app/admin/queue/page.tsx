'use client'
import * as React from "react";
import useSocketIoClient from "@/app/ui/hooks/useSocketIoClient";
import useFetch from "@/app/ui/hooks/useFetch";


export default function Queue() {

    const {isConnected, on, emit} = useSocketIoClient('http://localhost:8082');
    const [isEmitted, setIsEmitted] = React.useState(false); // only in dev mode
    const { post } = useFetch();
    const [inQ, setInQ] = React.useState({map: new Map<string, any>()})

    React.useEffect(() => {
        if (isEmitted) {
            return;
        }
        console.log('querying...')
        on('query_result', (msg: {type: 'initial' | 'remove' | 'add', data: {id: string}}) => {
            setInQ((q) => {
                switch (msg.type) {
                    case "initial":
                    case "add":
                        q.map.set(msg.data.id, msg.data)
                        break;
                    case "remove":
                        q.map.delete(msg.data.id);
                        break;
                }

                return {
                    map: q.map
                }
            })
        });

        emit('query', {queueId: 'ligma', limit: 20});
        setIsEmitted(true);
    }, [isEmitted, on, emit]);

    return (
        <>
            {Array.from(inQ.map.values()).map((q) =>
                <div key={q.id} style={{display: 'flex'}}>
                    <p>{JSON.stringify(q)}</p>
                    <button onClick={() => post('http://localhost:8081/admin/serve', {queueId: 'ligma', joinId: q.id})}>serve</button>
                </div>
            )}
            <h1>admin queue view</h1>
        </>
    );
}