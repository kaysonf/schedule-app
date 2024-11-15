import * as React from 'react';

export default function useFetch<T>() {

    const [data, setData] = React.useState<T | undefined>(undefined);
    const [error, setError] = React.useState(false);
    const [loading, setLoading] = React.useState(true);

    async function post<B>(url: string, body: B) {
        setLoading(true);
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            const data = await res.json();
            setData(data);
            setError(false);
        } else {
            setError(true);
        }

        setLoading(false);
    }

    return {
        post,
        data,
        error,
        loading
    }
}