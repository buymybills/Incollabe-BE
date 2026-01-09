import { compareVersions, isVersionLessThan, isVersionGreaterThan, isVersionEqual } from './version-compare.util';

describe('Version Compare Utility', () => {
  describe('compareVersions', () => {
    it('should return 0 for equal versions', () => {
      expect(compareVersions('4.0.0', '4.0.0')).toBe(0);
      expect(compareVersions('5.1.2', '5.1.2')).toBe(0);
      expect(compareVersions('1.0', '1.0.0')).toBe(0);
    });

    it('should return -1 when first version is less', () => {
      expect(compareVersions('4.0.0', '5.0.0')).toBe(-1);
      expect(compareVersions('4.9.0', '5.0.0')).toBe(-1);
      expect(compareVersions('3.9.9', '4.0.0')).toBe(-1);
      expect(compareVersions('1.2.3', '1.2.4')).toBe(-1);
    });

    it('should return 1 when first version is greater', () => {
      expect(compareVersions('5.0.0', '4.0.0')).toBe(1);
      expect(compareVersions('5.0.0', '4.9.0')).toBe(1);
      expect(compareVersions('4.0.0', '3.9.9')).toBe(1);
      expect(compareVersions('1.2.4', '1.2.3')).toBe(1);
    });

    it('should handle versions with different lengths', () => {
      expect(compareVersions('1.0', '1.0.0')).toBe(0);
      expect(compareVersions('1.0', '1.0.1')).toBe(-1);
      expect(compareVersions('1.1', '1.0.9')).toBe(1);
    });

    it('should ignore beta/rc suffixes', () => {
      expect(compareVersions('4.0.0-beta', '4.0.0')).toBe(0);
      expect(compareVersions('5.0.0-rc1', '4.9.0')).toBe(1);
      expect(compareVersions('4.0.0-beta', '5.0.0-rc1')).toBe(-1);
    });

    it('should handle double-digit version numbers', () => {
      expect(compareVersions('10.0.0', '9.0.0')).toBe(1);
      expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
      expect(compareVersions('1.0.10', '1.0.9')).toBe(1);
    });
  });

  describe('isVersionLessThan', () => {
    it('should correctly identify lesser versions', () => {
      expect(isVersionLessThan('4.0.0', '5.0.0')).toBe(true);
      expect(isVersionLessThan('3.9.0', '4.0.0')).toBe(true);
      expect(isVersionLessThan('5.0.0', '5.0.0')).toBe(false);
      expect(isVersionLessThan('5.0.0', '4.0.0')).toBe(false);
    });
  });

  describe('isVersionGreaterThan', () => {
    it('should correctly identify greater versions', () => {
      expect(isVersionGreaterThan('5.0.0', '4.0.0')).toBe(true);
      expect(isVersionGreaterThan('4.0.0', '3.9.0')).toBe(true);
      expect(isVersionGreaterThan('5.0.0', '5.0.0')).toBe(false);
      expect(isVersionGreaterThan('4.0.0', '5.0.0')).toBe(false);
    });
  });

  describe('isVersionEqual', () => {
    it('should correctly identify equal versions', () => {
      expect(isVersionEqual('4.0.0', '4.0.0')).toBe(true);
      expect(isVersionEqual('5.1.2', '5.1.2')).toBe(true);
      expect(isVersionEqual('4.0.0', '5.0.0')).toBe(false);
      expect(isVersionEqual('1.0', '1.0.0')).toBe(true);
    });
  });

  describe('Real-world scenarios', () => {
    it('Android version progression', () => {
      // Android: 3.0.0 -> 4.0.0 -> 4.1.0
      expect(isVersionLessThan('3.0.0', '4.0.0')).toBe(true);
      expect(isVersionLessThan('4.0.0', '4.1.0')).toBe(true);
      expect(isVersionLessThan('4.1.0', '4.1.0')).toBe(false);
    });

    it('iOS version progression', () => {
      // iOS: 4.0.0 -> 5.0.0 -> 5.1.0
      expect(isVersionLessThan('4.0.0', '5.0.0')).toBe(true);
      expect(isVersionLessThan('5.0.0', '5.1.0')).toBe(true);
      expect(isVersionGreaterThan('5.1.0', '5.0.0')).toBe(true);
    });
  });
});
