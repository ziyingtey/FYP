namespace bds_backend.Options;

public class BranchDirectoryOptions
{
    public const string SectionName = "BranchDirectory";

    /// <summary>Relative or absolute path to the managed branch directory JSON file.</summary>
    public string ImportPath { get; set; } = "Data/branch-directory.json";
}
