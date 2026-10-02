# Third-Party Model Provenance & Licensing

## 1. SFace: Face Recognition Model

* **Model Name**: SFace (SphereFace-based Mobile Face Recognition)
* **Exact Artifact Filename**: `face_recognition_sface_2021dec.onnx`
* **Upstream Repository**: `opencv/opencv_zoo`
* **Upstream Path**: `models/face_recognition_sface/face_recognition_sface_2021dec.onnx`
* **Exact Upstream Source URL**: [https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface](https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface) / [https://huggingface.co/opencv/face_recognition_sface/resolve/main/face_recognition_sface_2021dec.onnx](https://huggingface.co/opencv/face_recognition_sface/resolve/main/face_recognition_sface_2021dec.onnx)
* **Artifact License**: **Apache License 2.0** (as declared in the OpenCV Zoo official model repository)
* **Date Obtained**: 2026-10-02
* **Model Version/Tag**: `2021dec`
* **Model Size**: 38,700,564 bytes (36.91 MB)
* **SHA-256 Checksum**:
  `0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79`

### Architecture & Specification
* **Input Tensor**: `data` (Shape: `[1, 3, 112, 112]`, Datatype: `float32`)
* **Color Order / Layout**: BGR, NCHW ($1 \times 3 \times 112 \times 112$)
* **Normalization**: Aligned face crop with standard SFace image preprocessing
* **Output Tensor**: Shape `[1, 128]`, Datatype: `float32` (128-dimensional dense face feature embedding)
* **Distance Metric**: Cosine similarity between L2-normalized 128D unit vectors

### Provenance & Legal Attribution
* **Attribution**: OpenCV Zoo / SFace authors (Zhong et al., "SFace: Sigmoid-Constrained Hypersphere Loss for Robust Face Recognition", IEEE Transactions on Image Processing).
* **Compliance Note**: The ONNX model weights artifact is distributed by OpenCV Zoo under Apache 2.0. As standard with third-party neural network artifacts, training-data licensing has not been independently audited beyond the upstream repository's official Apache-2.0 release.
