"use client";

import type {ChangeEvent,SelectHTMLAttributes} from "react";

/** NET-AUDIT1.4 — a select that applies its form as soon as it changes.
 * The surrounding GET form keeps working without JavaScript (its submit
 * button stays available to keyboard and assistive technology).
 */
export function NetworkAutoSubmitSelect(props:SelectHTMLAttributes<HTMLSelectElement>){
  return <select {...props} onChange={(event:ChangeEvent<HTMLSelectElement>)=>{
    props.onChange?.(event);
    event.currentTarget.form?.requestSubmit();
  }}/>;
}
