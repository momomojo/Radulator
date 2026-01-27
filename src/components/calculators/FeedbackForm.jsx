import { useEffect } from "react";
import { useForm, ValidationError } from "@formspree/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trackFeedbackSubmission } from "@/lib/analytics";

export const FeedbackForm = {
  id: "feedback-form",
  category: "Feedback",
  name: "Send Feedback",
  desc: "Help improve Radulator by sharing bugs, feature requests, or general feedback.",
  metaDesc:
    "Send feedback to improve Radulator medical calculators. Report bugs, request features, or share your experience with our evidence-based radiology tools.",
  info: {
    text:
      "Your feedback helps us improve Radulator for all users. " +
      "Please provide as much detail as possible, especially for bug reports.\n\n" +
      "• Bug reports: Include calculator name and steps to reproduce\n" +
      "• Feature requests: Describe the calculator or enhancement you'd like to see\n" +
      "• General feedback: Share your experience and suggestions\n\n" +
      "All feedback is sent directly to the development team.",
  },
  // Special component flag to indicate this uses a custom render
  isCustomComponent: true,
  // Custom component for the feedback form
  Component: function FeedbackFormComponent() {
    // Formspree form ID for feedback submissions
    const [state, handleSubmit] = useForm("xgvpkawo");

    // Track successful feedback submissions
    useEffect(() => {
      if (state.succeeded) {
        trackFeedbackSubmission(true, "feedback-form");
      }
    }, [state.succeeded]);

    // Debug logging
    console.log("Formspree state:", state);
    console.log("Errors:", state.errors);
    console.log("Submitting:", state.submitting);
    console.log("Succeeded:", state.succeeded);

    if (state.succeeded) {
      return (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <p className="text-green-800 font-medium">
              Thank you for your feedback!
            </p>
            <p className="text-green-700 text-sm mt-1">
              We've received your message and will review it soon.
            </p>
          </div>
          <Button onClick={() => window.location.reload()} className="w-full">
            Send More Feedback
          </Button>
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              name="name"
              required
              placeholder="Your name"
            />
            <ValidationError prefix="Name" field="name" errors={state.errors} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              name="email"
              required
              placeholder="your@email.com"
            />
            <ValidationError
              prefix="Email"
              field="email"
              errors={state.errors}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="type">Feedback Type</Label>
          <select
            id="type"
            name="type"
            className="w-full border rounded p-2 focus:outline-none focus:ring focus:ring-blue-300"
            required
          >
            <option value="">Select type...</option>
            <option value="bug">Bug Report</option>
            <option value="feature">Feature Request</option>
            <option value="general">General Feedback</option>
          </select>
          <ValidationError prefix="Type" field="type" errors={state.errors} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="calculator">Related Calculator (if applicable)</Label>
          <select
            id="calculator"
            name="calculator"
            className="w-full border rounded p-2 focus:outline-none focus:ring focus:ring-blue-300"
          >
            <option value="">Select calculator...</option>
            <option value="adrenal-ct">Adrenal Washout CT</option>
            <option value="adrenal-mri">Adrenal MRI CSI</option>
            <option value="prostate-volume">Prostate Volume</option>
            <option value="renal-cyst">Renal Cyst Bosniak</option>
            <option value="renal-nephrometry">RENAL Nephrometry Score</option>
            <option value="spleen-size">Spleen Size ULN</option>
            <option value="hip-dysplasia">Hip Dysplasia Indices</option>
            <option value="mr-elastography">MR Elastography</option>
            <option value="other">Other / General</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="message">Message</Label>
          <textarea
            id="message"
            name="message"
            rows={5}
            required
            className="w-full border rounded p-2 focus:outline-none focus:ring focus:ring-blue-300"
            placeholder="Please describe your feedback in detail..."
          />
          <ValidationError
            prefix="Message"
            field="message"
            errors={state.errors}
          />
        </div>

        {state.errors && Object.keys(state.errors).length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-700 text-sm font-medium mb-2">
              There was an error submitting your feedback:
            </p>
            <ul className="text-red-600 text-xs space-y-1">
              {Object.entries(state.errors).map(([field, errors]) => (
                <li key={field}>
                  <strong>{field}:</strong>{" "}
                  {Array.isArray(errors) ? errors.join(", ") : errors}
                </li>
              ))}
            </ul>
            <p className="text-red-600 text-xs mt-2">
              Raw error object: {JSON.stringify(state.errors)}
            </p>
          </div>
        )}

        <Button type="submit" disabled={state.submitting} className="w-full">
          {state.submitting ? "Sending..." : "Send Feedback"}
        </Button>

        <p className="text-xs text-gray-500 text-center">
          By submitting this form, you agree to share your feedback with the
          Radulator development team.
        </p>
      </form>
    );
  },
  // Empty fields array since we're using a custom component
  fields: [],
  // Empty compute function
  compute: () => ({}),
  // No references needed for feedback form
  refs: [],
};
