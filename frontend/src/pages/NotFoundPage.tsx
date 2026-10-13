import { Link } from "react-router-dom";
import "./NotFoundPage.css";

export default function NotFoundPage() {
  return (
    <div className="notfound-page">
      <p className="notfound-code">404</p>
      <h1 className="notfound-title">This page went for a walk</h1>
      <p className="notfound-message muted">
        The page you are looking for does not exist or may have been moved.
      </p>
      <Link to="/" className="btn btn-primary">
        Back to home
      </Link>
    </div>
  );
}
