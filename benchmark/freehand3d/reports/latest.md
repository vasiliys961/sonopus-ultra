# Freehand 3D benchmark

Числа ниже сняты прогоном `collectStage2Report`. Это не клиническая ошибка и не подставленный отчёт.

- Pose provider for MAE: registration
- In-plane translation MAE, mm: 0
- Rotation MAE: not reported. These cases have no ground-truth rotation, and 2D registration does not estimate out-of-plane motion.
- Surface distance and dimension error: not implemented. They are not replaced by a visual score.
- Coverage of the registration pair: 1
- Rejected frames in that pair: 0
- Reconstruction time for 100 frames at 480×360, stride 4, ms: 74
- clinicallyValidated: false

## Timings

- 20 frames 320×240 stride 2: 14 ms, voxels 9
- 50 frames 320×240 stride 2: 25 ms, voxels 9
- 100 frames 320×240 stride 2: 16 ms, voxels 9
- 20 frames 480×360 stride 4: 1 ms, voxels 9
- 20 frames 640×480 stride 4: 2 ms, voxels 9
- 100 frames 480×360 stride 4: 74 ms, voxels 9
- 200 frames 320×240 stride 2: 43 ms, voxels 9
