'use client'
import * as React from "react";
import useFetch from '@/app/ui/hooks/useFetch';
export default function Queue() {

    const {
        data,
        post
    } = useFetch<{joinId: string}>();

    return (
        <>
            {data && <h1>{data.joinId}</h1>}
            <button onClick={() => post('http://localhost:8081/customer/queue', {queueId: 'ligma'})}>join queue</button>
        </>
    );
}