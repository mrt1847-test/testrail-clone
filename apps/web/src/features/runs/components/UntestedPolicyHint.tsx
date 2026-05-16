type Props = {
  visible: boolean;
};

export function UntestedPolicyHint({ visible }: Props) {
  if (!visible) return null;
  return (
    <p className="text-xs text-slate-500">
      Untested cannot be selected after a test already has a result. Choose another status to record a new result.
    </p>
  );
}
