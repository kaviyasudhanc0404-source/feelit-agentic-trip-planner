import { Link } from "react-router-dom";
import { Notice } from "@/components/Shell";

export default function NotFound() {
  return (
    <Notice title="You've wandered off the map" action={<Link to="/" className="btn btn-primary">Back to Feel It</Link>}>
      This page doesn't exist. Let's get you back on the trail.
    </Notice>
  );
}
