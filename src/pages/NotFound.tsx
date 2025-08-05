import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-6 text-center">
      <div className="space-y-8 max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-amber-500 to-yellow-300 bg-clip-text text-transparent">404 - Page Not Found</h1>
        <p className="text-lg text-gray-300 animate-in fade-in delay-300 duration-700">
          Sorry, the page you're looking for doesn't exist.
        </p>
        <Button asChild variant="outline" className="wallet-adapter-button-custom mt-4">
          <Link to="/">Back to Memory Game</Link>
        </Button>
      </div>
    </div>
  );
}