import { flattenObjectWithPaths, unflattenObject } from '../../src/helpers';

describe('Dot escaping in keys', () => {
  it('should preserve dots in original keys', () => {
    const obj = {
      "auth.login": "Login",
      "auth.logout": "Logout",
      "menu": {
        "home": "Home",
        "auth.login": "Sign In"
      }
    };
    
    const flattened = flattenObjectWithPaths(obj);
    const unflattened = unflattenObject(flattened);
    
    expect(unflattened).toEqual(obj);
  });

  it('should handle the society-flow menu structure', () => {
    const obj = {
      "menu": {
        "legal": "Legal",
        "legal.terms-of-service": "Terms of Service",
        "legal.privacy-policy": "Privacy Policy"
      }
    };
    
    const flattened = flattenObjectWithPaths(obj);
    const unflattened = unflattenObject(flattened);
    
    expect(unflattened).toEqual(obj);
    expect((unflattened.menu as any).legal).toBe("Legal");
    expect((unflattened.menu as any)["legal.terms-of-service"]).toBe("Terms of Service");
  });

  it('should handle arrays correctly', () => {
    const obj = {
      "items": ["one", "two", "three"],
      "nested": {
        "list": ["a", "b"]
      }
    };
    
    const flattened = flattenObjectWithPaths(obj);
    const unflattened = unflattenObject(flattened);
    
    expect(unflattened).toEqual(obj);
  });
});