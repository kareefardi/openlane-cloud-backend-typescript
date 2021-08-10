#!/usr/bin/env bash
#--chdir
for i in "$@"; do
    case $i in
    --tag=*)
    tag="${i#*=}"
    ;;
    --design-name=*)
    design_name="${i#*=}"
    ;;
    --threads=*)
    threads="${i#*=}"
    ;;
    --input-bucket=*)
    input_bucket="${i#*=}"
    ;;
    --output-bucket=*)
    output_bucket="${i#*=}"
    ;;
    --cpus=*)
    cpus="${i#*=}"
    ;;
    --memory=*)
    memory="${i#*=}"
    ;;
    *)
    ;;
esac
done

sbatch --job-name="$design_name"-"$tag" --output=slurm-"$tag".out --nodes=1 -t00:50:00 ./src/openlane-job.sh --cb=https://storage.googleapis.com/"$input_bucket" --ob=gs://"$output_bucket" "$@"
