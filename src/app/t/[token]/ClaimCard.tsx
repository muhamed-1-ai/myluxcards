"use client";
import { useState } from "react";

export default function ClaimCard({state,token,signedIn}:{state:"ready"|"not-found"|"unavailable"|"claimed";token:string;signedIn:boolean}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState<{slug:string}|null>(null);
  const claim=async()=>{
    if(!signedIn){sessionStorage.setItem("myluxcards_auth_next",window.location.pathname);window.location.href=`/?login=1&next=${encodeURIComponent(window.location.pathname)}`;return;}
    setBusy(true);setError("");
    try{const response=await fetch("/api/cards/claim",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})});const body=await response.json();if(!response.ok)throw new Error(body.message);setSuccess({slug:body.slug});}catch(e){setError(e instanceof Error?e.message:"This MyLuxCard could not be activated.");}finally{setBusy(false)}
  };
  const message=state==="not-found"?"This MyLuxCard could not be found.":state==="unavailable"?"This MyLuxCard is currently unavailable.":state==="claimed"?"This MyLuxCard has already been activated.":"Your MyLuxCard is ready.";
  return <main className="claim-shell"><section className="claim-card"><a className="claim-logo" href="/">MYLUX<span>CARDS</span></a><p className="claim-kicker">YOUR WORLD. ONE CARD.</p>{success?<><h1>Your MyLuxCard is live.</h1><div className="claim-status">✓ ACTIVATED</div><a className="claim-primary" href="/dashboard?tab=cards">EDIT MY CARD</a><a className="claim-secondary" href={`/card/${success.slug}`}>VIEW MY CARD</a></>:<><h1>{message}</h1>{state==="ready"&&<button className="claim-primary" onClick={claim} disabled={busy}>{busy?"ACTIVATING…":signedIn?"CLAIM MY CARD":"SIGN IN TO CLAIM"}</button>}{error&&<p role="alert" className="claim-error">{error}</p>}</>}<p className="claim-footer">Tap. Claim. Connect.</p></section></main>;
}
