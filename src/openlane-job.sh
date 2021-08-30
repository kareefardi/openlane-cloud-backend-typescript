#!/usr/bin/env bash
set -x
echo "$@"
OPEN_LANE_PATH=/apps/openlane
PDK_ROOT=/apps/openlane/pdks
#export STD_CELL_LIBRARY=

while [ $# -gt 0 ]; do
  case "$1" in
    --cb=*)
      cb="${1#*=}"
      ;;
    --ob=*)
      ob="${1#*=}"
      ;;
    --type=*)
      type="${1#*=}"
      ;;
    --config=*)
      config="${1#*=}"
      ;;
    --tag=*)
      tag="${1#*=}"
      ;;
    --design-dir=*)
      design_dir="${1#*=}"
      ;;
    --design-name=*)
      design_name="${1#*=}"
      ;;
    --regression-script=*)
      regression_script="${1#*=}"
      ;;
    --threads=*)
      threads="${1#*=}"
      ;;
    --cpus=*)
      cpus="${1#*=}"
      ;;
    --memory=*)
      memory="${1#*=}"
      ;;
    *)
      printf "* Invalid argument Passed *"
#      exit 1
  esac
  shift
done
cd /apps/openlane || \
     { echo "Cannot enter openlane dir"; exit 1; }

module load singularity/3.7.3
    case "$type" in
    regular)
        srun singularity run -B $OPEN_LANE_PATH:/openLANE_flow -B $PDK_ROOT:$PDK_ROOT --env "PDK_ROOT=$PDK_ROOT" "$cb"/openlane.sif python3 run_designs.py --designs "$design_dir" --tag "$tag" --threads "$threads" --disable_timestamp --clean --config_tag "$config"
      ;;
    exploratory)
        srun singularity run -B $OPEN_LANE_PATH:/openLANE_flow -B $PDK_ROOT:$PDK_ROOT --env "PDK_ROOT=$PDK_ROOT" "$cb"/openlane.sif python3 run_designs.py --designs "$design_dir" --tag "$tag" --regression "$regression_script" --threads "$threads" --disable_timestamp --clean
      ;;
    *)
      printf "*     Invalid run type    *"
      exit 1
      ;;
    esac

    # append a random string to make the file name unique
    # rs=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 16 | head -n 1)
    # outputDir="${ob}/$tag"

    # write the output file to the output bucket with the unique name
    # and make it readable
    # gsutil cp /apps/openlane/spm/designs/runs/ ${outputDir}
    # gsutil acl ch -g All:R ${outputDir}
module unload singularity/3.7.3

exit 0
