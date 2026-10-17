"use client";

import { useEffect } from "react";
import { NetworkRecoveryScreen } from "@/components/network-resilient-first-screen";

/** Route-scoped recovery: never print the server error, tenant identity or a fake company count. */
export default function NetworkDirectoryError({
 error,reset,
}:{
 error: Error & {digest?:string};
 reset:()=>void;
}) {
 useEffect(()=>{console.error("Network directory route failed",error);},[error]);
 return <NetworkRecoveryScreen retry={reset}/>;
}
