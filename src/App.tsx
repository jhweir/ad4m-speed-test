import { Ad4mClient, LinkQuery, Perspective } from '@coasys/ad4m'
import Ad4mConnect from '@coasys/ad4m-connect'
import React, { useEffect, useState } from 'react'
import './App.scss'

function App() {
    const [ad4m, setAd4m] = useState<any>(null)
    const [localPerspectives, setLocalPerspectives] = useState<any[]>([])
    const [selectedPerspective, setSelectedPerspective] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [loadTime, setLoadTime] = useState(0)
    // new perspective
    const [perspectiveModalOpen, setPerspectiveModalOpen] = useState(false)
    const [perspectiveName, setPerspectiveName] = useState('')
    const [totalPosts, setTotalPosts] = useState('')
    const [totalLikes, setTotalLikes] = useState('')

    const [posts, setPosts] = useState<any[]>([])

    async function getPerspectives(client: Ad4mClient) {
        client.perspective.all().then((perspectives: any[]) => {
            console.log('perspectives: ', perspectives)
            Promise.all(
                perspectives
                    .filter((p) => p.name.includes('speed-testing2'))
                    .map(async (p) => {
                        const name = await p.get(new LinkQuery({ predicate: 'has_name' }))
                        const numberOfPosts = await p.get(new LinkQuery({ predicate: 'total_posts' }))
                        const numberOfLikes = await p.get(new LinkQuery({ predicate: 'total_likes' }))
                        return {
                            perspective: p,
                            name: name[0]?.data.target,
                            totalPosts: numberOfPosts[0]?.data.target,
                            totalLikes: numberOfLikes[0]?.data.target,
                        }
                    })
            ).then((data: any) => setLocalPerspectives(data.filter((p: any) => !p.perspective.neighbourhood)))
        })
    }

    async function createLike(perspective: any, post: any, index: number) {
        const likeExpression = await perspective.createExpression({ index }, 'literal')
        perspective.add({ source: post, predicate: 'has_like', target: likeExpression })
    }

    async function createPost(perspective: any, index: number, numberOfLikes: number) {
        // create post
        const postExpression = await perspective.createExpression({ index }, 'literal')
        // link post to perspective
        await perspective.add({ source: perspective.uuid, predicate: 'has_post', target: postExpression })
        // create likes
        for (let i = 0; i < +numberOfLikes; i += 1) createLike(perspective, postExpression, i)
    }

    async function createPerspective() {
        // create perspective
        const newPerspective = await ad4m.perspective.add(`speed-testing2-${perspectiveName}`)
        // add links
        ad4m.perspective
            .addLinks(newPerspective.uuid, [
                { source: newPerspective.uuid, predicate: 'has_name', target: perspectiveName },
                { source: newPerspective.uuid, predicate: 'total_posts', target: totalPosts },
                { source: newPerspective.uuid, predicate: 'total_likes', target: totalLikes },
            ])
            .then(() => {
                // create posts & likes
                for (let i = 0; i < +totalPosts; i += 1) createPost(newPerspective, i, +totalLikes)
                // reset state
                setPerspectiveName('')
                setTotalPosts('')
                setTotalLikes('')
                setPerspectiveModalOpen(false)
                getPerspectives(ad4m)
            })
    }

    async function getPosts() {
        setLoading(true)
        const start = new Date()
        // get post links
        const postLinks = await selectedPerspective.perspective.get(new LinkQuery({ predicate: 'has_post' }))
        // get posts from links
        const postExpressions = await Promise.all(
            postLinks.map(async (postLink: any) => {
                const post = await ad4m.expression.get(postLink.data.target)
                return { literal: postLink.data.target, data: post.data ? JSON.parse(post.data) : {} }
            })
        )
        // get likes
        Promise.all(
            postExpressions.map(async (post) => {
                // get answer links
                const likeLinks = await selectedPerspective.perspective.get(
                    new LinkQuery({ source: post.literal, predicate: 'has_like' })
                )
                const likes = await Promise.all(likeLinks.map((link: any) => ad4m.expression.get(link.data.target)))
                return { post, likes: likes.map((like) => (like.data ? JSON.parse(like.data) : {})) }
            })
        ).then((postsWithLikes) => {
            setLoadTime((new Date().getTime() - start.getTime()) / 1000)
            setPosts(postsWithLikes)
            setLoading(false)
        })
    }

    // initialise ad4m
    useEffect(() => {
        const ui = Ad4mConnect({
            appName: 'My First ADAM App',
            appDesc: 'This is my first app here.',
            appDomain: 'ad4m.dev',
            appIconPath: 'https://i.ibb.co/GnqjPJP/icon.png',
            capabilities: [{ with: { domain: '*', pointers: ['*'] }, can: ['*'] }],
            hosting: true,
        })
        ui.connect().then((client) => {
            setAd4m(client)
            getPerspectives(client)
            console.log('client', client)
        })
    }, [])

    // get expressions when selected perspective changes
    useEffect(() => {
        console.log(selectedPerspective)
        if (selectedPerspective) getPosts()
    }, [selectedPerspective])

    return (
        <div className="wrapper">
            <h1>Ad4m app</h1>

            <button className="button" type="button" onClick={() => setPerspectiveModalOpen(!perspectiveModalOpen)}>
                New Perspective
            </button>

            {perspectiveModalOpen && (
                <div className="column centerX border" style={{ padding: 10 }}>
                    <div className="row centerY" style={{ marginBottom: 10 }}>
                        <p style={{ marginRight: 10 }}>Name:</p>
                        <input
                            className="input"
                            value={perspectiveName}
                            onChange={(e) => setPerspectiveName(e.target.value)}
                        />
                    </div>
                    <div className="row centerY" style={{ marginBottom: 10 }}>
                        <p style={{ marginRight: 10 }}>Total Posts:</p>
                        <input className="input" value={totalPosts} onChange={(e) => setTotalPosts(e.target.value)} />
                    </div>
                    <div className="row centerY" style={{ marginBottom: 10 }}>
                        <p style={{ marginRight: 10 }}>Likes Per Post:</p>
                        <input className="input" value={totalLikes} onChange={(e) => setTotalLikes(e.target.value)} />
                    </div>
                    <button className="button" type="button" onClick={createPerspective}>
                        Create Perspective
                    </button>
                </div>
            )}

            <h2>Local Perspectives</h2>
            <div>
                {localPerspectives.map((p) => (
                    <button
                        key={p.perspective.uuid}
                        className={`perspective-icon ${
                            selectedPerspective &&
                            p.perspective.uuid === selectedPerspective.perspective.uuid &&
                            'selected'
                        }`}
                        onClick={() => setSelectedPerspective(p)}
                        type="button"
                    >
                        <h2>{p.name}</h2>
                        <p style={{ marginBottom: 10 }}>Total Posts: {p.totalPosts}</p>
                        <p>Total Likes: {p.totalLikes}</p>
                    </button>
                ))}
            </div>

            {selectedPerspective && (
                <div className="border column centerX" style={{ width: 'calc(100% - 60px)' }}>
                    <h2 style={{ marginBottom: 10 }}>{selectedPerspective.name}</h2>

                    {loading ? <p>Loading...</p> : <p>Load time: {loadTime} seconds</p>}

                    <div style={{ marginTop: 20 }}>
                        {posts.map((p) => (
                            <div className="post" style={{ marginBottom: 10 }}>
                                <h1>{p.post.data.title}</h1>
                                <p style={{ marginBottom: 10 }}>Post Number: {p.post.data.index + 1}</p>
                                <p>Total Likes: {p.likes.length}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
